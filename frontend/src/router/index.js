import { createRouter, createWebHistory } from "vue-router";
import LoginView from "../views/LoginView.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: "/", name: "login", component: LoginView, meta: { public: true } },
    { path: "/home", name: "home", component: () => import("../views/HomeView.vue") },
    { path: "/form", name: "form", component: () => import("../views/FormView.vue") },
    { path: "/approve", name: "approve", component: () => import("../views/ApproveView.vue") },
    { path: "/list", name: "list", component: () => import("../views/ListView.vue") }
  ]
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  if (localStorage.getItem("user")) return true;
  return { name: "login" };
});

export default router;
