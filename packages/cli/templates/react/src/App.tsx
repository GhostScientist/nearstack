import { Chat } from './components/Chat';
import { ModelSetup } from './components/ModelSetup';
import { TodoList } from './components/TodoList';
import './App.css';

function App() {
  return (
    <div className="layout">
      <main>
        <h1>Nearstack</h1>
        <p>Local-first todos with integrated AI chat.</p>
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
