export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface BaseProvider {
  id: string;
  type: string;
}

export type StateListener = () => void;

export type Unsubscribe = () => void;
