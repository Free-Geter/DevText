// 点击按钮打开格式化工具
document.getElementById('openTool').addEventListener('click', () => {
  chrome.tabs.create({
    url: chrome.runtime.getURL('index.html')
  });
});

// 也可以通过快捷键打开
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html')
    });
  }
});
