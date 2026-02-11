import { Chat } from './components/Chat';
import { ModelSetup } from './components/ModelSetup';
import { TodoList } from './components/TodoList';
import './App.css';

function App() {
  return (
    <div className="layout">
      <main>
        <h1>Nearstack</h1>
        <p>Local-first productivity with private AI, powered by your device.</p>
        <TodoList />
      </main>
      <aside>
        <ModelSetup />
        <Chat />
      </aside>
    </div>
  );
}

export default App;
