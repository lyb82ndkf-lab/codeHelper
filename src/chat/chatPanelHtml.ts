// chatPanelHtml.ts - CodeHelper 聊天面板完整 HTML
// 参考 cc-haha 的 UI 结构：侧边会话列表 + 主聊天区 + 设置页

export function getChatPanelHtml(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<title>CodeHelper</title>
<style>
:root{--bg:var(--vscode-sideBar-background);--fg:var(--vscode-sideBar-foreground,#ccc);--ib:var(--vscode-input-background,#3c3c3c);--if:var(--vscode-input-foreground,#ccc);--bb:var(--vscode-button-background,#0e639c);--bf:var(--vscode-button-foreground,#fff);--ab:var(--vscode-editor-background,#252526);--bd:var(--vscode-widget-border,#474747);--sb:var(--vscode-scrollbarSlider-background);--hb:var(--vscode-list-hoverBackground)}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:var(--vscode-font-family,sans-serif);font-size:var(--vscode-font-size,13px);color:var(--fg);background:var(--ab);height:100vh;overflow:hidden;display:flex;flex-direction:column}

/* Header */
.hdr{display:flex;align-items:center;padding:6px 12px;border-bottom:1px solid var(--bd);gap:8px;flex-shrink:0}
.hdr-title{font-weight:600;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hdr-btn{background:none;border:none;color:var(--fg);cursor:pointer;padding:4px 6px;border-radius:4px;font-size:14px;opacity:.7}
.hdr-btn:hover{opacity:1;background:var(--hb)}

/* Sidebar (session list) */
.wrap{display:flex;flex:1;overflow:hidden}
.side{width:200px;border-right:1px solid var(--bd);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden}
.side-hdr{padding:8px;border-bottom:1px solid var(--bd);font-size:11px;color:#888;display:flex;justify-content:space-between;align-items:center}
.side-list{flex:1;overflow-y:auto;padding:4px}
.side-list::-webkit-scrollbar{width:4px}
.side-item{padding:6px 8px;border-radius:4px;cursor:pointer;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.side-item:hover{background:var(--hb)}
.side-item.active{background:var(--bb);color:var(--bf)}
.side-del{display:none;float:right;color:#888;font-size:11px;cursor:pointer}
.side-item:hover .side-del{display:inline}
.side-del:hover{color:#f44}

/* Main chat area */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.msgs{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px}
.msgs::-webkit-scrollbar{width:5px}
.msgs::-webkit-scrollbar-thumb{background:var(--sb);border-radius:3px}
.msg{display:flex;flex-direction:column;max-width:85%}
.msg.user{align-self:flex-end}.msg.ai{align-self:flex-start}
.msg-role{font-size:10px;color:#666;margin-bottom:1px;padding:0 4px}
.msg-body{padding:8px 12px;border-radius:8px;line-height:1.55;word-break:break-word;font-size:13px}
.msg.user .msg-body{background:var(--bb);color:var(--bf);border-bottom-right-radius:2px}
.msg.ai .msg-body{background:#2a2d2e;border:1px solid var(--bd);border-bottom-left-radius:2px}

/* Code in messages */
pre{background:#1e1e1e;border:1px solid var(--bd);border-radius:4px;padding:8px;margin:6px 0;overflow-x:auto;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;line-height:1.4;white-space:pre}
.ch{display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.04);padding:2px 8px;border-radius:4px 4px 0 0;font-size:10px;color:#888}
.ch+pre{border-radius:0 0 4px 4px;margin-top:0}
.cb{background:none;border:1px solid var(--bd);color:var(--fg);cursor:pointer;padding:1px 5px;border-radius:3px;font-size:10px}
.cb:hover{background:var(--bb);color:var(--bf)}
:not(pre)>code{background:#1e1e1e;padding:1px 4px;border-radius:3px;font-size:.9em}
.tb{background:#1a2332;border:1px solid #2d4a6f;border-radius:5px;padding:5px 8px;margin:4px 0;font-size:11px}
.tb.ok{border-left:3px solid #4ec9b0}.tb.err{border-left:3px solid #f44747}

/* Input area */
.inp-wrap{padding:8px 12px;border-top:1px solid var(--bd);flex-shrink:0}
.inp-row{display:flex;gap:6px;align-items:flex-end}
.inp{flex:1;background:var(--ib);border:1px solid var(--ib);color:var(--if);border-radius:6px;padding:7px 10px;font-family:inherit;font-size:13px;resize:none;min-height:34px;max-height:120px;line-height:1.4;outline:none}
.inp:focus{border-color:var(--bb)}
.send{background:var(--bb);color:var(--bf);border:none;border-radius:6px;padding:7px 12px;cursor:pointer;font-size:14px;height:34px;min-width:34px}
.send.stop{background:#f44747}

/* Model selector */
.model-sel{display:flex;gap:6px;margin-bottom:6px;align-items:center}
.model-sel label{font-size:11px;color:#888}
.model-sel select{background:var(--ib);color:var(--if);border:1px solid var(--bd);border-radius:4px;padding:2px 6px;font-size:11px;font-family:inherit}

/* Slash command menu */
.slash-menu{position:absolute;bottom:100%;left:0;right:0;background:var(--ab);border:1px solid var(--bd);border-radius:6px;margin-bottom:4px;max-height:200px;overflow-y:auto;display:none;z-index:10}
.slash-menu.show{display:block}
.slash-item{padding:6px 10px;cursor:pointer;font-size:12px}
.slash-item:hover,.slash-item.active{background:var(--hb)}
.slash-item .cmd{color:var(--bb);font-weight:600;margin-right:6px}
.slash-item .desc{color:#888}

/* Typing indicator */
.typing{display:inline-flex;gap:4px;padding:4px 0}
.typing span{width:5px;height:5px;background:#888;border-radius:50%;animation:dot 1.2s infinite ease-in-out}
.typing span:nth-child(2){animation-delay:.2s}
.typing span:nth-child(3){animation-delay:.4s}
@keyframes dot{0%,60%,100%{transform:translateY(0);opacity:.3}30%{transform:translateY(-5px);opacity:1}}

/* Thinking animation */
.thinking{display:flex;align-items:center;gap:8px;padding:4px 8px;font-size:11px;color:#888;font-style:italic}
.thinking-dots{display:inline-flex;gap:3px}
.thinking-dots span{width:4px;height:4px;background:var(--bb);border-radius:50%;animation:think 1.4s infinite ease-in-out}
.thinking-dots span:nth-child(2){animation-delay:.15s}
.thinking-dots span:nth-child(3){animation-delay:.3s}
@keyframes think{0%,80%,100%{transform:scale(0.6);opacity:.3}40%{transform:scale(1);opacity:1}}

/* Code diff display */
.diff-box{background:#1a1e22;border:1px solid var(--bd);border-radius:6px;margin:6px 0;font-size:12px;overflow:hidden}
.diff-header{display:flex;justify-content:space-between;align-items:center;padding:4px 8px;background:rgba(255,255,255,.03);border-bottom:1px solid var(--bd);font-size:11px;color:#888}
.diff-header .file{color:var(--fg);font-family:var(--vscode-editor-font-family,monospace)}
.diff-body{padding:4px 0;max-height:300px;overflow-y:auto}
.diff-line{padding:1px 8px;font-family:var(--vscode-editor-font-family,monospace);font-size:12px;white-space:pre}
.diff-add{background:rgba(74,222,128,.12);color:#4ade80}
.diff-del{background:rgba(248,113,113,.12);color:#f87171;text-decoration:line-through}
.diff-ctx{color:#888}
.diff-info{padding:4px 8px;font-size:11px;color:#888;border-top:1px solid var(--bd)}

/* Welcome */
.welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#666}
.welcome-icon{font-size:42px;opacity:.5}
.welcome h2{font-size:16px;font-weight:600;color:var(--fg)}
.welcome p{font-size:12px;color:#888;text-align:center;line-height:1.8}

/* Settings panel */
.settings{display:none;flex:1;overflow-y:auto;padding:16px}
.settings.show{display:block}
.settings h3{font-size:14px;margin-bottom:12px;color:var(--fg)}
.sg{margin-bottom:16px}
.sg label{display:block;font-size:12px;color:#888;margin-bottom:4px}
.sg select,.sg input[type=text],.sg input[type=password]{width:100%;background:var(--ib);color:var(--if);border:1px solid var(--bd);border-radius:4px;padding:5px 8px;font-size:12px;font-family:inherit}
.sg select:focus,.sg input:focus{border-color:var(--bb)}
.sg .row{display:flex;gap:8px;align-items:center}
.sg .row label{margin:0;flex:1}
.tog{position:relative;width:28px;height:16px;flex-shrink:0}
.tog input{opacity:0;width:0;height:0}
.tog .sl{position:absolute;cursor:pointer;inset:0;background:#555;border-radius:8px;transition:.2s}
.tog .sl:before{content:'';position:absolute;width:12px;height:12px;left:2px;bottom:2px;background:#fff;border-radius:50%;transition:.2s}
.tog input:checked+.sl{background:var(--bb)}
.tog input:checked+.sl:before{transform:translateX(12px)}
.save-btn{background:var(--bb);color:var(--bf);border:none;border-radius:4px;padding:6px 16px;cursor:pointer;font-size:12px;margin-top:8px}
.save-btn:hover{opacity:.9}
.saved{color:#4ec9b0;font-size:11px;margin-left:8px;opacity:0;transition:opacity .3s}
.saved.show{opacity:1}
</style>
</head>
<body>

<!-- Header -->
<div class="hdr">
  <div class="hdr-title">CodeHelper</div>
  <button class="hdr-btn" id="btnNew" title="新建对话">+</button>
  <button class="hdr-btn" id="btnHist" title="历史对话">=</button>
  <button class="hdr-btn" id="btnSet" title="设置">*</button>
</div>

<div class="wrap">
  <!-- Sidebar: session list -->
  <div class="side" id="sidePanel">
    <div class="side-hdr">
      <span>对话列表</span>
      <span id="sideClose" style="cursor:pointer;font-size:14px">✕</span>
    </div>
    <div class="side-list" id="sideList"></div>
  </div>

  <!-- Main area -->
  <div class="main" id="mainArea">
    <!-- Chat view -->
    <div class="msgs" id="msgs">
      <div class="welcome" id="empty">
        <div class="welcome-icon">C</div>
        <h2>CodeHelper AI</h2>
        <p>
          [Chat] 聊天模式 - 问 AI 代码问题<br>
          [Agent] Agent 模式 - AI 可读写文件、执行命令<br><br>
          <b>/explain</b> 解释代码 &nbsp; <b>/fix</b> 修复代码 &nbsp; <b>/optimize</b> 优化<br>
          选中代码 -> 右键 -> CodeHelper 操作
        </p>
      </div>
    </div>

    <!-- Settings view -->
    <div class="settings" id="settings">
      <h3>Settings</h3>
      <div class="sg">
        <label>AI 服务提供商</label>
        <select id="sProvider">
          <option value="ollama">Ollama (本地)</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="custom">自定义 OpenAI 兼容</option>
        </select>
      </div>
      <div class="sg">
        <label>API Key</label>
        <input type="password" id="sApiKey" placeholder="输入 API Key">
      </div>
      <div class="sg" id="sBaseUrlGroup" style="display:none">
        <label>自定义 API 地址</label>
        <input type="text" id="sBaseUrl" placeholder="https://api.example.com/v1">
      </div>
      <div class="sg">
        <label>聊天模型</label>
        <input type="text" id="sChatModel" placeholder="qwen2.5:3b">
      </div>
      <div class="sg">
        <label>补全模型</label>
        <input type="text" id="sCompModel" placeholder="qwen2.5-coder:3b">
      </div>
      <div class="sg">
        <div class="row">
          <label>启用 Agent 模式</label>
          <label class="tog"><input type="checkbox" id="sAgent" checked><span class="sl"></span></label>
        </div>
      </div>
      <div class="sg">
        <div class="row">
          <label>启用代码补全</label>
          <label class="tog"><input type="checkbox" id="sCompletion" checked><span class="sl"></span></label>
        </div>
      </div>
      <div class="sg">
        <label>最大 Token</label>
        <input type="text" id="sMaxTokens" placeholder="8192">
      </div>
      <div class="sg">
        <label>温度 (0-1)</label>
        <input type="text" id="sTemp" placeholder="0.2">
      </div>
      <button class="save-btn" id="sSave">保存设置</button>
      <span class="saved" id="sSaved">✓ 已保存</span>
    </div>

    <!-- Input area (only for chat view) -->
    <div class="inp-wrap" id="inputArea">
      <div class="model-sel">
        <label>模型:</label>
        <select id="modelSel">
          <option>加载中...</option>
        </select>
        <label style="margin-left:8px">模式:</label>
        <select id="modeSel">
          <option value="chat">Chat</option>
          <option value="agent">Agent</option>
        </select>
      </div>
      <div class="inp-row" style="position:relative">
        <div class="slash-menu" id="slashMenu"></div>
        <textarea class="inp" id="inp" placeholder="输入问题... (/ 查看命令)" rows="1"></textarea>
        <button class="send" id="sendBtn">▶</button>
      </div>
    </div>
  </div>
</div>

<script>
(function(){
  var vscode = acquireVsCodeApi();
  var msgsEl = document.getElementById('msgs');
  var inp = document.getElementById('inp');
  var sendBtn = document.getElementById('sendBtn');
  var sideList = document.getElementById('sideList');
  var sidePanel = document.getElementById('sidePanel');
  var settingsEl = document.getElementById('settings');
  var inputArea = document.getElementById('inputArea');
  var emptyEl = document.getElementById('empty');
  var slashMenu = document.getElementById('slashMenu');
  var modelSel = document.getElementById('modelSel');
  var modeSel = document.getElementById('modeSel');

  var gen = false, curEl = null, curText = '', chatVisible = true;
  var statusEl = null; // 复用单个状态元素
  var sessions = [], curSessionId = null;
  var slashCmds = [
    {cmd:'/explain',desc:'解释选中代码'},
    {cmd:'/fix',desc:'修复代码错误'},
    {cmd:'/optimize',desc:'优化代码性能'},
    {cmd:'/comment',desc:'添加代码注释'},
    {cmd:'/test',desc:'生成单元测试'},
    {cmd:'/review',desc:'代码审查'},
    {cmd:'/doc',desc:'生成文档'}
  ];

  // ===== Session management =====
  function newSession(mode) {
    var id = 's_' + Date.now();
    var s = {id:id, title:'新对话', mode:mode||'chat', msgs:[]};
    sessions.unshift(s);
    curSessionId = id;
    renderSide();
    clearChat();
    saveSessions();
  }

  function switchSession(id) {
    curSessionId = id;
    renderSide();
    var s = sessions.find(function(x){return x.id===id});
    if (!s) return;
    clearChat();
    modeSel.value = s.mode || 'chat';
    for (var i = 0; i < s.msgs.length; i++) {
      var m = s.msgs[i];
      addMsg(m.role === 'user' ? 'user' : 'ai', m.role === 'user' ? escH(m.content) : m.content, true);
    }
  }

  function deleteSession(id, ev) {
    ev.stopPropagation();
    sessions = sessions.filter(function(s){return s.id!==id});
    if (curSessionId === id) {
      curSessionId = sessions.length > 0 ? sessions[0].id : null;
      if (curSessionId) switchSession(curSessionId); else clearChat();
    }
    renderSide();
    saveSessions();
  }

  function renderSide() {
    sideList.innerHTML = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i];
      var d = document.createElement('div');
      d.className = 'side-item' + (s.id === curSessionId ? ' active' : '');
      d.innerHTML = '<span>' + escH(s.title) + '</span><span class="side-del" data-id="' + s.id + '">✕</span>';
      d.setAttribute('data-id', s.id);
      d.onclick = (function(sid){ return function(){ switchSession(sid); }; })(s.id);
      d.querySelector('.side-del').onclick = (function(sid){ return function(ev){ deleteSession(sid, ev); }; })(s.id);
      sideList.appendChild(d);
    }
  }

  function saveSessions() {
    vscode.postMessage({type:'saveSessions', sessions:sessions, curId:curSessionId});
  }

  function updateTitle(text) {
    if (!curSessionId) return;
    var s = sessions.find(function(x){return x.id===curSessionId});
    if (s && s.title === '新对话') {
      s.title = text.substring(0, 30).replace(/\\n/g,' ') || '新对话';
      renderSide();
      saveSessions();
    }
  }

  // ===== Chat =====
  function clearChat() {
    msgsEl.innerHTML = '';
    statusEl = null;
    if (emptyEl) { var e = emptyEl.cloneNode(true); e.style.display=''; msgsEl.appendChild(e); }
    curEl = null; curText = '';
  }

  function addMsg(role, html, noScroll) {
    if (emptyEl) emptyEl.style.display = 'none';
    var d = document.createElement('div');
    d.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
    var rl = document.createElement('div');
    rl.className = 'msg-role';
    rl.textContent = role === 'user' ? 'You' : 'CodeHelper';
    var body = document.createElement('div');
    body.className = 'msg-body';
    body.innerHTML = html;
    d.appendChild(rl); d.appendChild(body);
    msgsEl.appendChild(d);
    if (!noScroll) scrollB();
    return body;
  }

  function addToolBox(name, args, result, isErr) {
    if (emptyEl) emptyEl.style.display = 'none';
    var d = document.createElement('div');
    d.style.cssText = 'font-size:11px;padding:3px 8px;border-left:2px solid '+(isErr?'#f87171':'#4ade80')+';margin:2px 0;color:#aaa;background:rgba(255,255,255,.02)';

    // 一行摘要
    var summary = name;
    if (args) {
      if (args.file_path) summary += ' ' + args.file_path.split('\\/').pop();
      else if (args.path) summary += ' ' + args.path.split('\\/').pop();
      else if (args.command) summary += ' ' + args.command.substring(0, 50);
      else if (args.pattern) summary += ' ' + args.pattern;
    }

    if (isErr) {
      d.innerHTML = '<span style="color:#f87171">[FAIL]</span> ' + escH(summary);
      if (result) {
        var errDetail = result.length > 200 ? result.substring(0, 200) + '...' : result;
        d.innerHTML += '<div style="color:#f87171;margin-top:2px">' + escH(errDetail) + '</div>';
      }
    } else if (result) {
      // 成功：只显示关键信息
      var oneLine = result.split('\\n')[0];
      if (oneLine.length > 120) oneLine = oneLine.substring(0, 120) + '...';
      d.innerHTML = '<span style="color:#4ade80">[OK]</span> ' + escH(summary) +
        '<div style="color:#888;margin-top:1px">' + escH(oneLine) + '</div>';
    } else {
      d.innerHTML = '<span style="color:#4ade80">[OK]</span> ' + escH(summary);
    }

    msgsEl.appendChild(d); scrollB();
  }

  function startAI() {
    // 如果已经有 thinking 元素，不要重复创建
    if (curEl && curEl.querySelector && curEl.querySelector('.thinking')) { return; }
    curText = '';
    curEl = addMsg('ai', '<div class="thinking"><div class="thinking-dots"><span></span><span></span><span></span></div><span>Thinking...</span></div>');
  }
  function appendAI(t) { curText += t; if (curEl) { curEl.innerHTML = renderMd(curText); scrollB(); } }
  function doneAI() { gen=false; sendBtn.className='send'; sendBtn.textContent='\\u25b6'; curEl=null; curText=''; }

  function send() {
    var t = inp.value.trim(); if (!t || gen) return;
    var mode = modeSel.value;
    if (!curSessionId) newSession(mode);
    addMsg('user', escH(t));
    updateTitle(t);
    inp.value = ''; autoH();
    startAI(); gen=true; sendBtn.className='send stop'; sendBtn.textContent='\\u23f9';
    // Save user msg to session
    var s = sessions.find(function(x){return x.id===curSessionId});
    if (s) { s.msgs.push({role:'user',content:t}); saveSessions(); }
    vscode.postMessage({type:'sendMessage',content:t,mode:mode});
  }

  function scrollB() { msgsEl.scrollTop = msgsEl.scrollHeight; }
  function autoH() { inp.style.height='auto'; inp.style.height=Math.min(inp.scrollHeight,120)+'px'; }

  // ===== Markdown =====
  function renderMd(s) {
    var o='',lines=s.split('\\n'),ic=false,cl='',cx=[];
    for (var i=0;i<lines.length;i++) {
      var l=lines[i];
      if (!ic && /^\\x60\\x60\\x60(\\w*)$/.test(l)) { ic=true; cl=RegExp.$1||''; cx=[]; continue; }
      if (ic && /^\\x60\\x60\\x60\\s*$/.test(l)) {
        ic=false;
        var code=cx.join('\\n');
        // 检测是否是 diff 输出（包含 +/- 开头的行）
        var hasDiffLines=false;
        for(var di=0;di<cx.length;di++){
          if(cx[di].match(/^[\\+\\-]/)){hasDiffLines=true;break;}
        }
        if(hasDiffLines && cx.length>2){
          // 渲染为 diff 视图
          o+='<div class="diff-box"><div class="diff-header"><span class="file">'+escH(cl||'changes')+'</span><button class="cb" onclick="window._cp(\\''+('d'+Math.random().toString(36).substr(2,9))+'\\')">copy</button></div><div class="diff-body">';
          for(var di=0;di<cx.length;di++){
            var dl=escH(cx[di]);
            if(cx[di].charAt(0)==='+'){o+='<div class="diff-line diff-add">'+dl+'</div>';}
            else if(cx[di].charAt(0)==='-'){o+='<div class="diff-line diff-del">'+dl+'</div>';}
            else{o+='<div class="diff-line diff-ctx">'+dl+'</div>';}
          }
          o+='</div></div>';
        } else {
          // 普通代码块
          var id='c'+Math.random().toString(36).substr(2,9);
          o+='<div class="ch"><span>'+escH(cl)+'</span><button class="cb" onclick="window._cp(\\''+id+'\\')">copy</button></div><pre id="'+id+'"><code>'+escH(code)+'</code></pre>';
        }
        continue;
      }
      if (ic) { cx.push(l); continue; }
      var x=escH(l);
      x=x.replace(/\\*\\*(.+?)\\*\\*/g,'<b>$1</b>');
      x=x.replace(/\\*(.+?)\\*/g,'<i>$1</i>');
      x=x.replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>');
      x=x.replace(/^### (.+)$/gm,'<b>$1</b>');
      x=x.replace(/^## (.+)$/gm,'<b style="font-size:1.05em">$1</b>');
      x=x.replace(/^# (.+)$/gm,'<b style="font-size:1.15em">$1</b>');
      x=x.replace(/^> (.+)$/gm,'<span style="color:#aaa;border-left:3px solid #555;padding-left:8px">$1</span>');
      x=x.replace(/^[-*] (.+)$/gm,'\\u2022 $1');
      o+=x+'\\n';
    }
    return o;
  }

  function escH(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  window._cp = function(id) {
    var el=document.getElementById(id); if(!el) return;
    navigator.clipboard.writeText(el.textContent);
    var b=el.previousElementSibling; if(b){b=b.querySelector('.cb');if(b){b.textContent='\\u2713';setTimeout(function(){b.textContent='\\u590d\\u5236';},1500);}}
  };

  // ===== Slash commands =====
  function showSlash(filter) {
    slashMenu.innerHTML = '';
    var items = slashCmds.filter(function(c){ return !filter || c.cmd.indexOf(filter)===0; });
    if (items.length === 0) { hideSlash(); return; }
    for (var i=0;i<items.length;i++) {
      var d = document.createElement('div');
      d.className = 'slash-item';
      d.innerHTML = '<span class="cmd">'+items[i].cmd+'</span><span class="desc">'+items[i].desc+'</span>';
      d.setAttribute('data-cmd', items[i].cmd);
      d.onclick = (function(cmd){
        return function(){
          inp.value = cmd + ' ';
          hideSlash();
          inp.focus();
        };
      })(items[i].cmd);
      slashMenu.appendChild(d);
    }
    slashMenu.classList.add('show');
  }
  function hideSlash() { slashMenu.classList.remove('show'); }

  // ===== Settings =====
  function showSettings() {
    chatVisible = false;
    settingsEl.classList.add('show');
    inputArea.style.display = 'none';
    msgsEl.style.display = 'none';
    sidePanel.style.display = 'none';
    vscode.postMessage({type:'getSettings'});
  }
  function showChat() {
    chatVisible = true;
    settingsEl.classList.remove('show');
    inputArea.style.display = '';
    msgsEl.style.display = '';
    sidePanel.style.display = '';
  }

  function applySettings(cfg) {
    document.getElementById('sProvider').value = cfg.provider || 'ollama';
    document.getElementById('sApiKey').value = cfg.apiKey || '';
    document.getElementById('sBaseUrl').value = cfg.apiBaseUrl || '';
    document.getElementById('sChatModel').value = cfg.chatModel || '';
    document.getElementById('sCompModel').value = cfg.completionModel || '';
    document.getElementById('sAgent').checked = cfg.enableAgent !== false;
    document.getElementById('sCompletion').checked = cfg.enableCompletion !== false;
    document.getElementById('sMaxTokens').value = cfg.maxTokens || '8192';
    document.getElementById('sTemp').value = cfg.temperature || '0.2';
    toggleBaseUrl();
  }

  function toggleBaseUrl() {
    var p = document.getElementById('sProvider').value;
    document.getElementById('sBaseUrlGroup').style.display = (p==='custom'||p==='openai') ? '' : 'none';
  }

  function saveSettings() {
    var cfg = {
      provider: document.getElementById('sProvider').value,
      apiKey: document.getElementById('sApiKey').value,
      apiBaseUrl: document.getElementById('sBaseUrl').value,
      chatModel: document.getElementById('sChatModel').value,
      completionModel: document.getElementById('sCompModel').value,
      enableAgent: document.getElementById('sAgent').checked,
      enableCompletion: document.getElementById('sCompletion').checked,
      maxTokens: parseInt(document.getElementById('sMaxTokens').value) || 8192,
      temperature: parseFloat(document.getElementById('sTemp').value) || 0.2,
    };
    vscode.postMessage({type:'saveSettings', config:cfg});
    var sv = document.getElementById('sSaved');
    sv.classList.add('show');
    setTimeout(function(){ sv.classList.remove('show'); }, 2000);
  }

  // ===== Events =====
  sendBtn.onclick = function() { gen ? vscode.postMessage({type:'stopGeneration'}) : send(); };
  inp.onkeydown = function(e) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };
  inp.oninput = function() {
    autoH();
    var v = inp.value;
    if (v.startsWith('/')) { showSlash(v); } else { hideSlash(); }
  };
  document.getElementById('btnNew').onclick = function(){ newSession(modeSel.value); showChat(); };
  document.getElementById('btnHist').onclick = function(){
    if (sidePanel.style.display==='none') { sidePanel.style.display=''; } else { sidePanel.style.display='none'; }
  };
  document.getElementById('btnSet').onclick = function(){
    if (chatVisible) showSettings(); else showChat();
  };
  document.getElementById('sideClose').onclick = function(){ sidePanel.style.display='none'; };
  document.getElementById('sProvider').onchange = toggleBaseUrl;
  document.getElementById('sSave').onclick = saveSettings;

  // ===== Message handler =====
  window.onmessage = function(e) {
    var m = e.data;
    switch (m.type) {
      case 'assistantStart': startAI(); break;
      case 'assistantChunk': appendAI(m.content); break;
      case 'assistantDone':
        doneAI();
        if (curSessionId && curText) {
          var s = sessions.find(function(x){return x.id===curSessionId});
          if (s) { s.msgs.push({role:'assistant',content:curText}); saveSessions(); }
        }
        break;
      case 'toolUse': addToolBox(m.name,m.args,null,false); break;
      case 'toolResult': addToolBox(m.name,null,m.result,m.isError); break;
      case 'modelInfo':
        document.querySelector('.hdr-title').textContent = m.model;
        // Update model selector
        modelSel.innerHTML = '';
        var opt = document.createElement('option');
        opt.value = m.model; opt.textContent = m.model + ' (' + m.provider + ')';
        modelSel.appendChild(opt);
        break;
      case 'error': doneAI(); addMsg('ai','[Error] '+escH(m.content)); break;
      case 'statusUpdate':
        if (!statusEl) {
          statusEl=document.createElement('div');
          statusEl.className='thinking';
          msgsEl.appendChild(statusEl);
        }
        statusEl.innerHTML='<div class="thinking-dots"><span></span><span></span><span></span></div><span>'+escH(m.text)+'</span>';
        scrollB(); break;
      case 'clearChat': clearChat(); break;
      case 'historyMessage':
        addMsg(m.role==='user'?'user':'ai', m.role==='user'?escH(m.content):m.content);
        break;
      case 'predefined':
        addMsg('user', escH(m.content));
        startAI(); gen=true; sendBtn.className='send stop'; sendBtn.textContent='\\u23f9';
        vscode.postMessage({type:'sendMessage',content:m.content,mode:'chat'});
        break;
      case 'settingsData': applySettings(m.config); break;
      case 'restoreSessions':
        sessions = m.sessions || [];
        curSessionId = m.curId || null;
        renderSide();
        if (curSessionId) switchSession(curSessionId);
        break;
    }
  };

  // Init
  vscode.postMessage({type:'ready'});
})();
</script>
</body>
</html>`;
}
