# test.py - Python 测试文件（包含错误）

# 错误1: 可变默认参数
def append_to(element, to=[]):
    to.append(element)
    return to

# 错误2: 异常处理太宽泛
try:
    result = 1 / 0
except:
    pass  # 吞掉所有异常

# 错误3: 列表推导式中的变量泄漏
x = 10
squares = [x for x in range(5)]
print(x)  # x 被覆盖为 4

# 错误4: 字符串格式化问题
name = "World"
message = "Hello, %s" % name  # 老式格式化，应该用 f-string

# 错误5: 未关闭文件
def read_file(path):
    f = open(path, 'r')  # 没有用 with 语句
    content = f.read()
    return content  # 文件未关闭

# 错误6: 除零未处理
def divide(a, b)：
    return a / b  # 没有处理 b=0 的情况

# 优化建议: 使用 enumerate 替代 range(len())
items = ['a', 'b', 'c']
for i in range(len(items)):
    print(i, items[i])  # 应该用 for i, item in enumerate(items)
