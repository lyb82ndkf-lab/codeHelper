// test.ts - TypeScript 测试文件（包含错误）

// 错误1: any 类型滥用
function processData(data: any): any {
    return data.foo.bar.baz; // 不安全的属性访问
}

// 错误2: 空值未处理
function getUserName(user: { name?: string }): string {
    return user.name.toUpperCase(); // user.name 可能是 undefined
}

// 错误3: 类型断言不安全
const input = document.getElementById('myInput') as HTMLInputElement;
input.value = 'hello'; // 如果元素不存在会崩溃

// 错误4: Promise 未处理 rejection
async function loadUser(id: number) {
    const response = await fetch(`/api/users/${id}`);
    return response.json(); // 可能失败但没有 catch
}

// 错误5: 数组方法返回值未检查
const numbers = [1, 2, 3, 4, 5];
const found = numbers.find(n => n > 10);
console.log(found.toFixed(2)); // found 可能是 undefined

// 错误6: 回调中 this 丢失
class Timer {
    seconds = 0;
    start() {
        setInterval(function() {
            this.seconds++; // this 不再指向 Timer 实例
        }, 1000);
    }
}

// 错误7: 类型不匹配
interface User {
    name: string;
    age: number;
}

function createUser(data: any): User {
    return data; // 没有验证 data 的结构
}

// 优化: 使用 optional chaining
const user = { profile: { email: 'test@example.com' } };
const email = user && user.profile && user.profile.email; // 应该用 user?.profile?.email
