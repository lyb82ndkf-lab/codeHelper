// ChatViewProvider v2.0.0 - 权限模式 + 图片 + 精简输出
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { chatStream, type ApiMessage } from '../models/apiClient';
import { agentLoop, type AgentCallbacks } from '../agent/agentLoop';
import { buildChatSystemPrompt } from '../agent/systemPrompt';
import { getConfig } from '../utils/config';
import { createSession, addMessageToSession, loadSessions, saveSessions, type ChatSession } from './chatPersistence';

export type PermissionMode = 'half' | 'full';

export class ChatViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'codeHelper.chatView';
    private view?: vscode.WebviewView;
    private currentSession: ChatSession;
    private abortController?: AbortController;
    private isReady = false;
    private pendingMessages: any[] = [];
    private permissionMode: PermissionMode = 'half';
    private imageUris: Record<string, string> = {};

    constructor(private readonly extensionUri: vscode.Uri) {
        this.currentSession = createSession('chat');
    }

    resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
        webviewView.webview.html = this.getHtml();

        // 生成静态图片的 webview URI
        const tools = ['edit_file', 'read_file', 'write_file', 'bash', 'glob_search', 'grep_search'];
        for (const t of tools) {
            const imgPath = path.join(this.extensionUri.fsPath, 'static', t + '.png');
            if (fs.existsSync(imgPath)) {
                this.imageUris[t] = webviewView.webview.asWebviewUri(vscode.Uri.file(imgPath)).toString();
            }
        }

        webviewView.webview.onDidReceiveMessage(async (msg) => {
            try {
                switch (msg.type) {
                    case 'ready':
                        this.isReady = true;
                        this.sendModelInfo();
                        this.sendToView({ type: 'imageUris', uris: this.imageUris });
                        this.sendToView({ type: 'permissionMode', mode: this.permissionMode });
                        this.replayHistory();
                        for (const m of this.pendingMessages) { this.sendToView(m); }
                        this.pendingMessages = [];
                        break;
                    case 'sendMessage': await this.handleSend(msg.content, msg.mode || 'chat'); break;
                    case 'stopGeneration': this.abortController?.abort(); break;
                    case 'newChat':
                        this.currentSession = createSession(msg.mode || 'chat');
                        this.sendToView({ type: 'clearChat' });
                        break;
                    case 'getSettings': this.sendSettings(); break;
                    case 'saveSettings': await this.applySettings(msg.config); break;
                    case 'setPermissionMode':
                        this.permissionMode = msg.mode === 'full' ? 'full' : 'half';
                        this.sendToView({ type: 'permissionMode', mode: this.permissionMode });
                        break;
                }
            } catch (e: any) { console.error('[CodeHelper]', e); }
        });

        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible && !this.isReady) {
                webviewView.webview.html = this.getHtml();
            }
        });
    }

    newChat(): void { this.currentSession = createSession('chat'); this.sendToView({ type: 'clearChat' }); }

    public async executeAction(action: string, code: string): Promise<void> {
        if (this.view) { this.view.show?.(true); }
        await this.waitForReady(3000);
        const editor = vscode.window.activeTextEditor;
        const lang = editor?.document.languageId || 'text';
        const filePath = editor?.document.uri.fsPath || '';

        const prompts: Record<string, string> = {
            explain: `用中文解释这段代码的功能、逻辑和关键点：\n\`\`\`${lang}\n${code}\n\`\`\``,
            fix: `文件路径：${filePath}\n请用 edit_file 修复以下代码中的错误：\n\`\`\`${lang}\n${code}\n\`\`\`\n注意：先用 read_file 读取文件获取真实内容，再用 edit_file 用文件中的真实代码作为 old_string 进行替换。`,
            optimize: `文件路径：${filePath}\n请用 edit_file 优化以下代码：\n\`\`\`${lang}\n${code}\n\`\`\`\n注意：先用 read_file 读取文件获取真实内容，再用 edit_file 修改。`,
            comment: `文件路径：${filePath}\n请用 edit_file 为以下代码添加中文注释：\n\`\`\`${lang}\n${code}\n\`\`\`\n注意：先用 read_file 读取文件获取真实内容，再用 edit_file 修改。`,
        };
        const content = prompts[action] || code;
        const mode = action === 'explain' ? 'chat' : 'agent';
        await this.handleSend(content, mode);
    }

    public async sendDiagnosticMessage(prompt: string): Promise<void> {
        if (this.view) { this.view.show?.(true); }
        await this.waitForReady(3000);
        await this.handleSend(prompt, 'chat');
    }

    private waitForReady(ms: number): Promise<void> {
        if (this.isReady) return Promise.resolve();
        return new Promise(resolve => {
            const check = setInterval(() => { if (this.isReady) { clearInterval(check); resolve(); } }, 100);
            setTimeout(() => { clearInterval(check); resolve(); }, ms);
        });
    }

    private replayHistory(): void {
        for (const msg of this.currentSession.messages) {
            this.sendToView({ type: 'historyMessage', role: msg.role, content: msg.content });
        }
    }

    private sendModelInfo(): void {
        const c = getConfig();
        this.sendToView({ type: 'modelInfo', model: c.chatModel, provider: c.provider });
    }

    private sendSettings(): void {
        const c = getConfig();
        this.sendToView({ type: 'settingsData', config: { provider: c.provider, apiKey: c.apiKey, apiBaseUrl: c.apiBaseUrl, chatModel: c.chatModel, completionModel: c.completionModel, enableAgent: c.enableAgent, enableCompletion: c.enableCompletion, maxTokens: c.maxTokens, temperature: c.temperature } });
    }

    private async applySettings(cfg: Record<string, any>): Promise<void> {
        const c = vscode.workspace.getConfiguration('codeHelper');
        for (const [k, v] of Object.entries(cfg)) { if (v !== undefined) await c.update(k, v, vscode.ConfigurationTarget.Global); }
        this.sendModelInfo();
    }

    private async handleSend(content: string, mode: string): Promise<void> {
        this.abortController = new AbortController();
        this.sendToView({ type: 'userMessage', content });
        this.sendToView({ type: 'assistantStart' });
        addMessageToSession(this.currentSession.id, 'user', content, this.currentSession);
        try {
            if (mode === 'agent' && getConfig().enableAgent) { await this.runAgent(content); }
            else { await this.runChat(content); }
        } catch (e: any) { if (e.name !== 'AbortError') this.sendToView({ type: 'error', content: e.message }); }
        finally { this.sendToView({ type: 'assistantDone' }); this.abortController = undefined; }
    }

    private async runAgent(content: string): Promise<void> {
        const messages: ApiMessage[] = this.currentSession.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        let full = '';
        const startTime = Date.now();
        const cb: AgentCallbacks = {
            permissionMode: this.permissionMode,
            onEvent: (e) => {
                if (e.type === 'text_delta') {
                    full += e.text;
                    // 不向用户显示模型的思考过程（只保留工具卡片和结果）
                }
                else if (e.type === 'tool_use') this.sendToView({ type: 'toolUse', name: e.name, args: e.args });
                else if (e.type === 'tool_result') this.sendToView({ type: 'toolResult', name: e.name, result: e.result.substring(0, 2000), isError: e.isError });
                else if (e.type === 'turn_start') {
                    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                    this.sendToView({ type: 'statusUpdate', text: `思考中 ${elapsed}s` });
                }
                else if (e.type === 'error') this.sendToView({ type: 'error', content: e.error });
            }
        };
        await agentLoop(content, messages, cb, this.abortController?.signal);
        // 完成后显示简洁摘要
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        this.sendToView({ type: 'assistantChunk', content: `\n\n✅ 完成 (${elapsed}s)` });
        if (full) addMessageToSession(this.currentSession.id, 'assistant', full, this.currentSession);
    }

    private async runChat(content: string): Promise<void> {
        const config = getConfig();
        const ws = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const history = this.currentSession.messages
            .filter(m => m.role === 'user' || m.role === 'assistant')
            .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
        const apiMessages: ApiMessage[] = [
            { role: 'system', content: buildChatSystemPrompt(ws) },
            ...history,
        ];
        let full = '';
        for await (const ev of chatStream(apiMessages, undefined, { model: config.chatModel, abortSignal: this.abortController?.signal })) {
            if (this.abortController?.signal.aborted) break;
            if (ev.type === 'text_delta') { full += ev.text; this.sendToView({ type: 'assistantChunk', content: ev.text }); }
            else if (ev.type === 'error') { this.sendToView({ type: 'error', content: ev.error }); return; }
        }
        if (full) addMessageToSession(this.currentSession.id, 'assistant', full, this.currentSession);
    }

    private sendToView(msg: any): void {
        if (this.isReady && this.view) this.view.webview.postMessage(msg);
        else this.pendingMessages.push(msg);
    }

    private getHtml(): string {
        return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src ${this.view?.webview.cspSource || '*'} data: ;">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family,sans-serif);font-size:var(--vscode-font-size,13px);color:var(--vscode-sideBar-foreground,#ccc);background:var(--vscode-editor-background,#1e1e1e);display:flex;flex-direction:column;height:100vh;overflow:hidden}
.hdr{padding:6px 10px;border-bottom:1px solid var(--vscode-widget-border);display:flex;align-items:center;justify-content:space-between}
.hdr-t{font-weight:600;font-size:12px}
.hdr-b button{background:none;border:none;color:var(--vscode-sideBar-foreground);cursor:pointer;padding:2px 6px;font-size:11px;border-radius:3px}
.hdr-b button:hover{background:var(--vscode-list-hoverBackground)}
.mode{display:flex;padding:3px 8px;gap:3px;border-bottom:1px solid var(--vscode-widget-border)}
.mode button{flex:1;background:none;border:1px solid transparent;color:var(--vscode-sideBar-foreground);cursor:pointer;padding:3px;border-radius:3px;font-size:11px}
.mode button.on{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.msgs{flex:1;overflow-y:auto;padding:6px 8px}
.msg{padding:3px 0;font-size:12px;line-height:1.5;word-break:break-word}
.msg.user{color:var(--vscode-textLink-foreground)}
.msg.ai{color:var(--vscode-sideBar-foreground)}
.msg.err{color:#f44747}
.msg.info{color:#888;font-size:11px;font-style:italic}
.tool-card{margin:6px 0;border:1px solid var(--vscode-widget-border);border-radius:6px;overflow:hidden;font-size:11px}
.tool-card-hdr{display:flex;align-items:center;gap:6px;padding:5px 8px;background:rgba(78,201,176,.08);border-bottom:1px solid var(--vscode-widget-border)}
.tool-card-hdr img{width:20px;height:20px}
.tool-card-hdr .name{font-weight:600;color:#4ec9b0}
.tool-card-hdr .file{color:#888;font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tool-card-body{padding:6px 8px}
.tool-diff-add{color:#4ade80;background:rgba(74,222,128,.08);padding:1px 4px;border-radius:2px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap}
.tool-diff-del{color:#f87171;background:rgba(248,113,113,.08);padding:1px 4px;border-radius:2px;text-decoration:line-through;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap}
.pre{background:var(--vscode-textBlockQuote-background);border:1px solid var(--vscode-widget-border);border-radius:3px;padding:5px 6px;margin:3px 0;font-family:var(--vscode-editor-font-family,monospace);font-size:11px;white-space:pre-wrap;overflow-x:auto}
.perm{display:flex;padding:3px 8px;gap:4px;border-top:1px solid var(--vscode-widget-border);align-items:center}
.perm span{font-size:10px;color:#888}
.perm button{background:none;border:1px solid var(--vscode-widget-border);color:var(--vscode-sideBar-foreground);cursor:pointer;padding:2px 8px;border-radius:3px;font-size:10px}
.perm button.on{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border-color:var(--vscode-button-background)}
.inp{padding:6px 8px;border-top:1px solid var(--vscode-widget-border)}
.inp textarea{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-widget-border);border-radius:3px;padding:5px 6px;font-family:inherit;font-size:12px;resize:none;min-height:28px;max-height:80px;outline:none}
.inp textarea:focus{border-color:var(--vscode-button-background)}
.inp-row{display:flex;gap:4px;margin-top:3px;align-items:center}
.inp button{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:11px}
.inp button.stop{background:#f44747}
.inp .model{font-size:10px;color:#888;flex:1}
.settings{display:none;padding:10px;overflow-y:auto;flex:1}
.settings h3{font-size:12px;margin-bottom:8px}
.sg{margin-bottom:10px}
.sg label{display:block;font-size:10px;color:#888;margin-bottom:2px}
.sg input,.sg select{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-widget-border);border-radius:3px;padding:3px 5px;font-size:11px;font-family:inherit}
.sg .row{display:flex;align-items:center;justify-content:space-between}
.sg .row label{margin:0}
.tog{width:26px;height:14px;position:relative;display:inline-block}
.tog input{opacity:0;width:0;height:0}
.tog .sl{position:absolute;cursor:pointer;inset:0;background:#555;border-radius:7px;transition:.2s}
.tog .sl:before{content:'';position:absolute;width:10px;height:10px;left:2px;bottom:2px;background:#fff;border-radius:50%;transition:.2s}
.tog input:checked+.sl{background:var(--vscode-button-background)}
.tog input:checked+.sl:before{transform:translateX(12px)}
.save{background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;padding:4px 10px;cursor:pointer;font-size:10px;margin-top:6px}
.saved{color:#4ec9b0;font-size:10px;margin-left:6px;opacity:0;transition:opacity .3s}
.saved.show{opacity:1}
.hidden{display:none!important}
</style></head><body>
<div class="hdr"><span class="hdr-t" id="title">CodeHelper</span><div class="hdr-b"><button onclick="showView('settings')">Set</button></div></div>
<div class="mode" id="modeBar"><button class="on" id="chatBtn" onclick="setMode('chat')">Chat</button><button id="agentBtn" onclick="setMode('agent')">Agent</button></div>
<div class="msgs" id="msgs"><div class="msg info" style="text-align:center;padding:20px">Type a message to start...</div></div>
<div class="settings" id="settings"><h3>Settings <button onclick="showView('chat')" style="background:none;border:1px solid var(--vscode-widget-border);color:var(--vscode-sideBar-foreground);cursor:pointer;padding:2px 8px;border-radius:3px;font-size:10px;float:right">Back</button></h3>
<div class="sg"><label>Provider</label><select id="sProv" onchange="toggleUrl()"><option value="ollama">Ollama</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option><option value="custom">Custom</option></select></div>
<div class="sg"><label>API Key</label><input type="password" id="sKey"></div>
<div class="sg" id="urlGrp" style="display:none"><label>API URL</label><input type="text" id="sUrl"></div>
<div class="sg"><label>Chat Model</label><input type="text" id="sChat"></div>
<div class="sg"><label>Completion Model</label><input type="text" id="sComp"></div>
<div class="sg"><div class="row"><label>Agent</label><label class="tog"><input type="checkbox" id="sAgent" checked><span class="sl"></span></label></div></div>
<div class="sg"><div class="row"><label>Completion</label><label class="tog"><input type="checkbox" id="sComp2" checked><span class="sl"></span></label></div></div>
<div class="sg"><label>Max Tokens</label><input type="text" id="sTokens"></div>
<div class="sg"><label>Temperature</label><input type="text" id="sTemp"></div>
<button class="save" onclick="saveSet()">Save</button><span class="saved" id="saved">OK</span></div>
<div class="perm" id="permBar"><span>权限：</span><button id="permHalf" class="on" onclick="clickPerm('half')">半允许</button><button id="permFull" onclick="clickPerm('full')">全部允许</button></div>
<div class="inp" id="inpArea"><textarea id="inp" placeholder="Ask anything..." rows="1"></textarea>
<div class="inp-row"><span class="model" id="modelInfo">loading...</span><button id="sendBtn" onclick="doSend()">Send</button></div></div>
<script>
var vscode=acquireVsCodeApi(),msgs=document.getElementById('msgs'),inp=document.getElementById('inp'),sb=document.getElementById('sendBtn'),md='chat',gen=false,imgUris={};
function setMode(m){md=m;document.getElementById('chatBtn').className=m==='chat'?'on':'';document.getElementById('agentBtn').className=m==='agent'?'on':'';inp.placeholder=m==='agent'?'Describe task...':'Ask anything...';vscode.postMessage({type:'newChat',mode:m});msgs.innerHTML='';}
function setPermUI(m){document.getElementById('permHalf').className=m==='half'?'on':'';document.getElementById('permFull').className=m==='full'?'on':'';}
function clickPerm(m){vscode.postMessage({type:'setPermissionMode',mode:m});}
function showView(v){var isChat=v==='chat';var msgsEl=document.getElementById('msgs');if(isChat){msgsEl.classList.remove('hidden');msgsEl.style.display='flex';msgsEl.style.flexDirection='column';}else{msgsEl.classList.add('hidden');msgsEl.style.display='none';}document.getElementById('modeBar').style.display=isChat?'flex':'none';document.getElementById('permBar').style.display=isChat?'flex':'none';document.getElementById('settings').style.display=isChat?'none':'block';document.getElementById('inpArea').style.display=isChat?'block':'none';if(!isChat)vscode.postMessage({type:'getSettings'});}
function toggleUrl(){var p=document.getElementById('sProv').value;document.getElementById('urlGrp').style.display=(p==='custom'||p==='openai')?'':'none';}
function doSend(){if(gen){vscode.postMessage({type:'stopGeneration'});return;}var t=inp.value.trim();if(!t)return;am('user',t);inp.value='';gen=true;sb.textContent='Stop';sb.className='stop';vscode.postMessage({type:'sendMessage',content:t,mode:md});}
function am(role,html){var d=document.createElement('div');d.className='msg '+role;if(role==='ai')d.innerHTML=md2(html);else d.textContent=html;msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;return d;}
function E(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function md2(s){var o='',lines=s.split('\\n'),ic=false,cx=[];for(var i=0;i<lines.length;i++){var l=lines[i];if(!ic&&/^\\x60\\x60\\x60(\\w*)$/.test(l)){ic=true;cx=[];continue;}if(ic&&/^\\x60\\x60\\x60/.test(l)){ic=false;var id='c'+Math.random().toString(36).substr(2,9);o+='<div class="pre" id="'+id+'">'+E(cx.join('\\n'))+'</div>';continue;}if(ic){cx.push(l);continue;}var x=E(l);x=x.replace(/\\*\\*(.+?)\\*\\*/g,'<b>$1</b>');x=x.replace(/\\*(.+?)\\*/g,'<i>$1</i>');x=x.replace(/\\x60([^\\x60]+)\\x60/g,'<code style="background:#252526;padding:1px 2px;border-radius:2px">$1</code>');o+=x+'\\n';}return o;}
window.onmessage=function(e){var m=e.data;switch(m.type){
case 'assistantStart':am('ai','<span style="color:#888;font-style:italic">思考中...</span>');break;
case 'assistantChunk':var last=msgs.lastElementChild;if(!last||!last.classList.contains('ai'))last=am('ai','');last.innerHTML=md2((last._ct||'')+m.content);last._ct=(last._ct||'')+m.content;msgs.scrollTop=msgs.scrollHeight;break;
case 'assistantDone':gen=false;sb.textContent='Send';sb.className='';break;
case 'toolUse':var icons={read_file:'📖',edit_file:'✏️',write_file:'💾',bash:'⚡',glob_search:'🔍',grep_search:'🔎'};var icon=icons[m.name]||'🔧';var fp=m.args&&m.args.file_path?E(String(m.args.file_path).split(/[\\/]/).pop()):'';var body='';if(m.name==='edit_file'&&m.args){var oldV=m.args.old_string?E(String(m.args.old_string).substring(0,150)):'';var newV=m.args.new_string?E(String(m.args.new_string).substring(0,150)):'';body='<div class="tool-card-body">';if(oldV)body+='<div class="tool-diff-del">- '+oldV+'</div>';if(newV)body+='<div class="tool-diff-add">+ '+newV+'</div>';body+='</div>';}else if(m.name==='read_file'&&m.args){body='<div class="tool-card-body" style="color:#888">'+E(String(m.args.file_path||''))+'</div>';}else if(m.name==='bash'&&m.args&&m.args.command){body='<div class="tool-card-body"><code style="background:#252526;padding:1px 4px;border-radius:2px">'+E(String(m.args.command).substring(0,120))+'</code></div>';}var imgSrc=imgUris[m.name]||'';var imgHtml=imgSrc?'<img src="'+imgSrc+'">':'<span style="font-size:14px">'+icon+'</span>';var card=document.createElement('div');card.className='tool-card';card.innerHTML='<div class="tool-card-hdr">'+imgHtml+'<span class="name">'+E(m.name)+'</span><span class="file">'+fp+'</span></div>'+body;msgs.appendChild(card);msgs.scrollTop=msgs.scrollHeight;break;
case 'toolResult':var tr=document.createElement('div');tr.style.cssText='font-size:10px;padding:2px 8px;color:'+(m.isError?'#f87171':'#4ade80');tr.textContent=(m.isError?'❌ ':'✅ ')+m.name+(m.isError?' 失败':' 成功');msgs.appendChild(tr);msgs.scrollTop=msgs.scrollHeight;break;
case 'statusUpdate':var si=msgs.lastElementChild;if(si&&si.classList.contains('info')){si.textContent=m.text;}else{am('info',m.text);}break;
case 'error':am('err','Error: '+m.content);gen=false;sb.textContent='Send';sb.className='';break;
case 'modelInfo':document.getElementById('modelInfo').textContent=m.model+' ('+m.provider+')';break;
case 'clearChat':msgs.innerHTML='';break;
case 'historyMessage':am(m.role==='user'?'user':'ai',m.content);break;
case 'userMessage':am('user',m.content);break;
case 'imageUris':imgUris=m.uris||{};break;
case 'permissionMode':setPermUI(m.mode);break;
case 'settingsData':var c=m.config;document.getElementById('sProv').value=c.provider||'ollama';document.getElementById('sKey').value=c.apiKey||'';document.getElementById('sUrl').value=c.apiBaseUrl||'';document.getElementById('sChat').value=c.chatModel||'';document.getElementById('sComp').value=c.completionModel||'';document.getElementById('sAgent').checked=c.enableAgent!==false;document.getElementById('sComp2').checked=c.enableCompletion!==false;document.getElementById('sTokens').value=c.maxTokens||'8192';document.getElementById('sTemp').value=c.temperature||'0.2';toggleUrl();break;
}};
function saveSet(){vscode.postMessage({type:'saveSettings',config:{provider:document.getElementById('sProv').value,apiKey:document.getElementById('sKey').value,apiBaseUrl:document.getElementById('sUrl').value,chatModel:document.getElementById('sChat').value,completionModel:document.getElementById('sComp').value,enableAgent:document.getElementById('sAgent').checked,enableCompletion:document.getElementById('sComp2').checked,maxTokens:parseInt(document.getElementById('sTokens').value)||8192,temperature:parseFloat(document.getElementById('sTemp').value)||0.2}});var s=document.getElementById('saved');s.classList.add('show');setTimeout(function(){s.classList.remove('show');},2000);}
inp.onkeydown=function(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}};
vscode.postMessage({type:'ready'});
</script></body></html>`;
    }

    dispose(): void { this.abortController?.abort(); }
}
