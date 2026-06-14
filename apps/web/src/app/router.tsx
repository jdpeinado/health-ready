import { createBrowserRouter } from "react-router-dom";
import { Protected } from "./Protected";
import { Layout } from "./Layout";
import { LoginPage } from "../auth/LoginPage";
import { NewWorkoutPage } from "../features/workouts/NewWorkoutPage";
import { EditWorkoutPage } from "../features/workouts/EditWorkoutPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { WorkoutDetailPage } from "../features/history/WorkoutDetailPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { ExercisesAdminPage } from "../features/exercises/ExercisesAdminPage";

export const router: ReturnType<typeof createBrowserRouter> =
  createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <Protected />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <NewWorkoutPage /> },
          { path: "/history", element: <HistoryPage /> },
          { path: "/workouts/:id", element: <WorkoutDetailPage /> },
          { path: "/workouts/:id/edit", element: <EditWorkoutPage /> },
          { path: "/progress", element: <ProgressPage /> },
          { path: "/exercises", element: <ExercisesAdminPage /> },
        ],
      },
    ],
  },
]);
