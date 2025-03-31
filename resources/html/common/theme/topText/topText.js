
function themeTopText() {
    let boxNode = document.getElementById("topTextBox");
    let textNum = Math.floor(Math.random() * 30) + 20;
    let textList = [
        "等待超时，请稍后重试QAQ!",
        "渲染失败QAQ!",
        "这里被管理员禁止使用这个功能了呐QAQ!",
        "格式错误QAQ!",
        "未找到符合条件的谱面QAQ!",
        "绑定sessionToken错误QAQ!",
        "更新失败QAQ!",
        "未找到存档QAQ!",
    ];
    for (let i = 0; i < textNum; ++i) {
        let pNode = document.createElement("p");
        pNode.style.top = Math.floor(Math.random() * 80 + 5) + "%";
        pNode.style.left = Math.floor(Math.random() * 90 + 5) + "%";
        pNode.style.fontSize =
            Math.floor(Math.random() * 20 + 10) + "px";
        pNode.style.filter =
            "blur(" + (Math.random() * 2 + 1) + "px)";
        pNode.innerText =
            textList[Math.floor(Math.random() * textList.length)];
        pNode.style.zIndex = Math.floor(Math.random() * 2);
        boxNode.appendChild(pNode);
    }
}

themeTopText();