let prompt=document.querySelector("#prompt")
let chatContainer=document.querySelector(".chatbot-container")
let fileInput=document.querySelector("#fileInput")
let imagebtn=document.querySelector("#image")

fileInput.addEventListener("change", () => {
  let files = fileInput.files;
  if (!files.length) return;

  Array.from(files).forEach(file => {
    let reader = new FileReader();
    reader.onload = () => {
      uploadedImages .push({
        mimeType: file.type,
        data: reader.result.split(",")[1]
      });

      let html = `<div class="user-chat-area">
        <img src="${reader.result}" width="150" style="border-radius:10px;">
      </div>
      <img src="woman.png" id="userImage" width="50">`;

      let userChatBox = createChatBox(html, "user-chat-box");
      chatContainer.appendChild(userChatBox);
      chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
    };
    reader.readAsDataURL(file);
  });
});

const Api_Url =
"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent";
const streamApiUrl= "/api/gemini";
let user={
    data:null,
}

let uploadedImages = [];
let conversationHistory=[];
let allChats = [];
let currentChatId = Date.now();
allChats.push({ id: currentChatId, title: "New Chat", history: [], html: chatContainer.innerHTML });

function saveCurrentChat() {
  let chat = allChats.find(c => c.id === currentChatId);
  if (chat) {
    chat.history = conversationHistory;
    chat.html = chatContainer.innerHTML;
  }
}

function newChat() {
  saveCurrentChat();
  currentChatId = Date.now();
  conversationHistory = [];
  chatContainer.innerHTML = `<div class="ai-chat-box">
    <img src="businessman.png" id="aiImage" width="50">
    <div class="ai-chat-area">Hello! How Can I Help you Today?</div>
  </div>`;
  allChats.push({ id: currentChatId, title: "New Chat", history: [], html: chatContainer.innerHTML });
  renderChatList();
}

function loadChat(id) {
  saveCurrentChat();
  let chat = allChats.find(c => c.id === id);
  if (chat) {
    currentChatId = id;
    conversationHistory = chat.history;
    chatContainer.innerHTML = chat.html;
  }
  document.getElementById("chatListPanel").style.display = "none";
}

function renderChatList() {
  let panel = document.getElementById("chatListPanel");
  panel.innerHTML = "";
  allChats.forEach(chat => {
    let row = document.createElement("div");
    row.style = "display:flex;align-items:center;justify-content:space-between;padding:4px 8px;";

    let btn = document.createElement("button");
    btn.textContent = chat.title;
    btn.style = "flex:1;text-align:left;padding:8px;background:none;border:none;color:white;cursor:pointer;";
    btn.onclick = () => loadChat(chat.id);

    let delBtn = document.createElement("button");
    delBtn.textContent = "🗑️";
    delBtn.style = "background:none;border:none;color:white;cursor:pointer;margin-left:6px;";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteChat(chat.id);
    };

    row.appendChild(btn);
    row.appendChild(delBtn);
    panel.appendChild(row);
  });
}

function deleteChat(id) {
  allChats = allChats.filter(c => c.id !== id);
  if (allChats.length === 0) {
    newChat();
    return;
  }
  if (id === currentChatId) {
    loadChat(allChats[0].id);
  } else {
    renderChatList();
  }
}

function formatMarkdown(text) {
  let codeBlocks = [];
  text = text.replace(/```([a-zA-Z]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    let escaped = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    let index = codeBlocks.length;
    codeBlocks.push(`<pre style="background:#1e1e1e;color:#d4d4d4;padding:10px;border-radius:6px;overflow-x:auto;"><code>${escaped}</code></pre>`);
    return "%%CODEBLOCK" + index + "%%";
  });

  let lines = text.split("\n");
  let html = "";
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.trim().startsWith("|")) {
      inTable = true;
      tableRows.push(line);
      continue;
    } else if (inTable) {
      html += renderTable(tableRows);
      tableRows = [];
      inTable = false;
    }
    html += line + "\n";
  }
  if (inTable) html += renderTable(tableRows);

  function renderTable(rows) {
    let out = "<table border='1' style='border-collapse:collapse;margin:8px 0;'>";
    rows.forEach((row, idx) => {
      if (/^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?$/.test(row)) return;
      let cells = row.split("|").filter(c => c.trim() !== "");
      let tag = idx === 0 ? "th" : "td";
      out += "<tr>" + cells.map(c => `<${tag} style='padding:4px 8px;'>${c.trim()}</${tag}>`).join("") + "</tr>";
    });
    out += "</table>";
    return out;
  }

  let result = html
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/### (.*?)(\n|$)/g, "<h3>$1</h3>")
    .replace(/## (.*?)(\n|$)/g, "<h2>$1</h2>")
    .replace(/\* (.*?)(\n|$)/g, "• $1<br>")
    .replace(/\n/g, "<br>");

  codeBlocks.forEach((block, index) => {
    result = result.replace("%%CODEBLOCK" + index + "%%", block);
  });

  return result;
}

function createChatBox(html,classes){
    let div=document.createElement("div")
    div.innerHTML=html
    div.classList.add(classes)
    return div
}

async function generateResponse(aiChatBox){

  let text=aiChatBox.querySelector(".ai-chat-area")

let RequestOption = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: conversationHistory
    })
};

try{
  let response = await fetch(streamApiUrl, RequestOption);
  let reader = response.body.getReader();
  let decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    let { value, done } = await reader.read();
    if (done) break;
    let chunk = decoder.decode(value, { stream: true });
    let lines = chunk.split("\n");
    for (let line of lines) {
      if (line.startsWith("data: ")) {
        try {
          let parsed = JSON.parse(line.slice(6));
          let piece = parsed.candidates[0].content.parts[0].text;
          fullText += piece;
          text.innerHTML = formatMarkdown(fullText);
          chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
        } catch(e) {}
      }
    }
  }
  conversationHistory.push({ role: "model", parts: [{ text: fullText }] });
}

catch(error){
    console.log(error);
} 
finally{chatContainer.scrollTo({top:chatContainer.scrollHeight,behavior:"smooth"})
}
}   

function handlechatResonse(message){
    user.data=message
    let userParts = [{ text: message }];
if (uploadedImages.length > 0) {
  uploadedImages.forEach(img => {
    userParts.push({ inline_data: { mime_type: img.mimeType, data: img.data } });
  });
  uploadedImages = [];
}
    conversationHistory.push({ role: "user", parts: userParts });
    let currentChat = allChats.find(c => c.id === currentChatId);
if (currentChat && currentChat.title === "New Chat") {
  currentChat.title = message.slice(0, 25) + (message.length > 25 ? "..." : "");
}
    let html= `<div class="user-chat-area">
      ${user.data}
    </div>
    <img src="woman.png" id="userImage" width="50">
    <div class="msg-menu" style="display:none;margin-top:4px;"><button class="edit-btn" data-msg="${encodeURIComponent(user.data)}" style="font-size:12px;">✏️ Edit</button></div>`;

    let userChatBox=createChatBox(html,"user-chat-box");
    chatContainer.appendChild(userChatBox);
    prompt.value=""
    chatContainer.scrollTo({top:chatContainer.scrollHeight,behavior:"smooth"})

    setTimeout(()=>{
        let html=`
        <div class="ai-chat-box">
        <img src="businessman.png" id="aiImage" width="50">
        <div class="ai-chat-area">
        <img src="loading.png" alt="" class="load" width="50px">
        </div>
        <div class="msg-menu" style="display:none;margin-top:4px;"><button class="copy-btn" style="font-size:12px;">📋 Copy</button></div>
        </div>
        `;
       let aiChatBox=createChatBox(html,"ai-chat-box")
       chatContainer.appendChild(aiChatBox)
       generateResponse(aiChatBox)

    },600)    
}
prompt.addEventListener("keydown",(e)=>{
    if(e.key=="Enter"){
        handlechatResonse(prompt.value)
     }
 })
 let submitbtn=document.querySelector("#submit")

 submitbtn.addEventListener("click",()=>{
    handlechatResonse(prompt.value)
 })

 imagebtn.addEventListener("click",()=>{
    fileInput.click()
 })

 chatContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("copy-btn")) {
    let aiArea = e.target.closest(".ai-chat-box").querySelector(".ai-chat-area");
    navigator.clipboard.writeText(aiArea.innerText);
    e.target.textContent = "✅ Copied";
    setTimeout(() => { e.target.textContent = "📋 Copy"; }, 1500);
    return;
  }
  if (e.target.classList.contains("edit-btn")) {
    let originalMsg = decodeURIComponent(e.target.dataset.msg);
    prompt.value = originalMsg;
    prompt.focus();
    return;
  }
  let bubble = e.target.closest(".ai-chat-area, .user-chat-area");
  if (bubble) {
    let box = bubble.closest(".ai-chat-box, .user-chat-box");
    let menu = box.querySelector(".msg-menu");
    if (menu) {
      menu.style.display = menu.style.display === "block" ? "none" : "block";
    }
  }
}); 
document.getElementById("newChatBtn").addEventListener("click", newChat);
document.getElementById("chatListBtn").addEventListener("click", () => {
  renderChatList();
  let panel = document.getElementById("chatListPanel");
  panel.style.display = panel.style.display === "block" ? "none" : "block";
});
let micBtn = document.querySelector("#mic")

let SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

if (SpeechRecognition) {
    let recognition = new SpeechRecognition()
    recognition.lang = "en-IN"
    recognition.continuous = false

    micBtn.addEventListener("click", () => {
        recognition.start()
        micBtn.textContent = "🔴"
    })

    recognition.addEventListener("result", (e) => {
        let spokenText = e.results[0][0].transcript
        prompt.value = spokenText
    })

    recognition.addEventListener("end", () => {
        micBtn.textContent = "🎤"
    })

    recognition.addEventListener("error", (e) => {
        console.log("Speech error:", e.error)
        micBtn.textContent = "🎤"
    })
} else {
    micBtn.disabled = true
    micBtn.title = "Voice typing not supported in this browser"
}
