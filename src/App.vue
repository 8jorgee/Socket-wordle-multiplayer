<template>
  <div id="app">
    <select-username
      v-if="!usernameAlreadySelected"
      @input="onUsernameSelection"
    />
    <div v-else class="chat-container">
      <div class="chat-list">
        <h3>Chats Disponibles</h3>
        <ul>
          <li
            :class="{ active: selectedChat === 'group' }"
            @click="selectChat('group')"
          >
            JUEGO (Chat Grupal)
          </li>
          <li
            v-for="user in privateChats"
            :key="user.userID"
            :class="{ active: selectedChat === user.userID }"
            @click="selectChat(user.userID)"
          >
            {{ user.username }}
          </li>
        </ul>
      </div>

      <div class="chat-section">
        <div v-if="selectedChat === 'group'" class="chat-messages">
          <h3 class="chat-title">Chat Grupal</h3>
          <div class="messages">
            <div
              v-for="msg in groupMessages"
              :key="msg.id"
              class="message"
              :class="{ 'message-from-me': msg.from === 'Tú' }"
            >
              <span class="message-user">{{ msg.from }}</span>
              <p class="message-content">{{ msg.content }}</p>
            </div>
          </div>
        </div>

        <div v-else class="chat-messages">
          <h3 class="chat-title">Chat con {{ getPrivateChatUsername(selectedChat) }}</h3>
          <div class="messages">
            <div
              v-for="msg in privateMessages[selectedChat]"
              :key="msg.id"
              class="message"
              :class="{ 'message-from-me': msg.from === 'Tú' }"
            >
              <span class="message-user">{{ msg.from }}</span>
              <p class="message-content">{{ msg.content }}</p>
            </div>
          </div>
        </div>

        <div class="message-input">
          <input
            v-model="messageContent"
            placeholder="Escribe un mensaje"
            @keyup.enter="sendMessage"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import SelectUsername from "./components/SelectUsername";
import socket from "./socket";

export default {
  name: "App",
  components: {
    SelectUsername,
  },
  data() {
    return {
      usernameAlreadySelected: false,
      privateChats: [],
      groupMessages: [],
      privateMessages: {},
      selectedChat: "group",
      messageContent: "",
    };
  },
  methods: {
    onUsernameSelection(username) {
      this.usernameAlreadySelected = true;
      socket.auth = { username };
      socket.connect();

      socket.on("users", (users) => {
        this.privateChats = users.filter(
          (user) => user.userID !== socket.id
        );
      });

      socket.on("user connected", (user) => {
        if (!this.privateChats.find((u) => u.userID === user.userID)) {
          this.privateChats.push(user);
        }
      });

      socket.on("user disconnected", (id) => {
        this.privateChats = this.privateChats.filter((u) => u.userID !== id);
      });

      socket.on("group-message", (message) => {
        this.groupMessages.push(message);
      });

      socket.on("private message", ({ content, from }) => {
        if (!this.privateMessages[from]) {
          this.$set(this.privateMessages, from, []);
        }
        this.privateMessages[from].push({ content, from });
      });
    },
    selectChat(chatID) {
      this.selectedChat = chatID;
    },
    getPrivateChatUsername(userID) {
      const user = this.privateChats.find((u) => u.userID === userID);
      return user ? user.username : "Desconocido";
    },
    sendMessage() {
      if (this.selectedChat === "group") {
        socket.emit("group-message", this.messageContent);
      } else {
        socket.emit("private message", {
          content: this.messageContent,
          to: this.selectedChat,
        });

        if (!this.privateMessages[this.selectedChat]) {
          this.$set(this.privateMessages, this.selectedChat, []);
        }
        this.privateMessages[this.selectedChat].push({
          content: this.messageContent,
          from: "Tú",
        });
      }
      this.messageContent = "";
    },
  },
};
</script>

<style>
body {
  margin: 0;
  font-family: Arial, sans-serif;
}

#app {
  display: flex;
  height: 100vh;
}

.chat-container {
  display: flex;
  width: 100%;
}

.chat-list {
  width: 25%;
  border-right: 1px solid #ccc;
  background-color: #f4f4f4;
  padding: 10px;
}

.chat-list ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.chat-list li {
  padding: 15px;
  cursor: pointer;
  border-radius: 5px;
  transition: background-color 0.3s;
}

.chat-list li:hover {
  background-color: #e0e0e0;
}

.chat-list li.active {
  background-color: #d1e7dd;
  font-weight: bold;
}

.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: #fff;
}

.chat-title {
  text-align: center;
  padding: 10px;
  background-color: #007bff;
  color: white;
  margin: 0;
}

.chat-messages {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  background-color: #f9f9f9;
}

.messages {
  width: 100%;
  max-width: 600px;
  display: flex;
  flex-direction: column;
}

.message {
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 10px;
  max-width: 80%;
}

.message-from-me {
  align-self: flex-end;
  background-color: #007bff;
  color: white;
}

.message-user {
  font-size: 12px;
  margin-bottom: 5px;
  color: #555;
}

.message-content {
  margin: 0;
}

.message-input {
  padding: 10px;
  border-top: 1px solid #ccc;
  background-color: #fff;
}

.message-input input {
  width: 100%;
  padding: 15px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 20px;
  box-sizing: border-box;
}
</style>
