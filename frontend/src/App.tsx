import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { Activity } from "./pages/Activity";
import { Dashboard } from "./pages/Dashboard";
import { NotFound } from "./pages/NotFound";
import { TaskForm } from "./pages/TaskForm";
import { Tasks } from "./pages/Tasks";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="tasks/new" element={<TaskForm />} />
        <Route path="tasks/:id/edit" element={<TaskForm />} />
        <Route path="activity" element={<Activity />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
