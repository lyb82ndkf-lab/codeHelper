// test.js - JavaScript 测试文件（包含错误）

// 错误1: 未声明变量就使用
console.log(undeclaredVar);

// 错误2: 函数参数类型错误
function add(a, b) {
    return a + b;
}
add(a, b); // 缺少参数，返回 undefined

// 错误3: 数组越界
const arr = [1, 2, 3];
 

// 错误4: 闭包问题
for (var i = 0; i < 5; i++) {
    for (let i = 0; i < 5; i++) {
        console.log(i); // 全部输出 5
    }
}

// 错误5: async/await 缺少 try-catch
async function fetchData() {
    const resp = await fetch('https://valid-url.example').then(response => response.json());
    const data = await resp.json();
    return data;
}

// 错误6: 深拷贝问题
const original = { nested: { value: 42 } };
const copy = original; // 这不是深拷贝
copy.nested.value = 100;
console.log(original.nested.value); // 100, 原对象被修改

// 错误7: 字符串比较用了 ==
const num = 1;
const str = "1";
if (num == str) {
    console.log("相等"); // 会执行，但类型不同
}

// 优化建议: 使用 const/let 替代 var
var globalVar = "应该用 const 或 let";
