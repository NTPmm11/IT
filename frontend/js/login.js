


const { createApp } = Vue;

createApp({
    data() {
        return {
            username: "",
            password: ""
        };
    },

    methods: {
        login() {

              console.log(this.username);
              console.log(this.password);
              console.log(this.remember);

            if (this.username === "" || this.password === "") {
                alert("กรุณากรอกข้อมูล");
                return;
            }

            window.location.href = "form.html";
        }
    }

}).mount("#app");