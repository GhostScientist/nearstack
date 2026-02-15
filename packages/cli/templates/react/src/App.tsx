import { Chat } from './components/Chat';
import { ModelSetup } from './components/ModelSetup';
import { TodoList } from './components/TodoList';

function App() {
  return (
    <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 p-6 lg:grid-cols-[2fr_1fr]">
      <main className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Nearstack</h1>
        <p className="text-slate-300">
          Local-first productivity with private AI powered by your device.
        </p>
        <TodoList />
      </main>
      <aside className="space-y-4">
        <ModelSetup />
        <Chat />
      </aside>
    </div>
  );
}

export default App;
