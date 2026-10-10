import { ToastProvider } from './Toast';
import { ProjectReviewView } from './views/ProjectReviewView';

/** Forge jira:projectSettingsPage entry — project admins only (auth on the server). */
export default function ProjectReviewScreen() {
  return (
    <ToastProvider>
      <ProjectReviewView />
    </ToastProvider>
  );
}
