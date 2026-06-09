# test.go - Go 测试文件（包含错误）

package main

import (
	"fmt"
	"os"
)

// 错误1: 忽略错误返回值
func readFile(path string) string {
	data, _ := os.ReadFile(path) // 忽略了 error
	return string(data)
}

// 错误2: 循环变量捕获
func printNumbers() {
	for i := 0; i < 5; i++ {
		go func() {
			fmt.Println(i) // 所有 goroutine 可能都打印 5
		}()
	}
}

// 错误3: 空指针解引用
type User struct {
	Name string
}

func printUser(u *User) {
	fmt.Println(u.Name) // u 可能是 nil
}

// 错误4: 资源未关闭
func processFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	// 忘记 defer f.Close()
	data := make([]byte, 1024)
	f.Read(data)
}

// 错误5: map 并发读写
func unsafeMapAccess() {
	m := make(map[string]int)
	go func() {
		m["key"] = 1 // 写
	}()
	fmt.Println(m["key"]) // 读，可能导致 panic
}

// 错误6: 字符串拼接性能差
func buildString(parts []string) string {
	result := ""
	for _, p := range parts {
		result += p // 应该用 strings.Builder
	}
	return result
}

func main() {
	fmt.Println("Hello, World!")
}
