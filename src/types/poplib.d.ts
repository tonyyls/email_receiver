declare module 'poplib' {
  import { EventEmitter } from 'events';

  interface POP3Config {
    host: string;
    port: number;
    username: string;
    password: string;
    tls?: boolean;
    enabletls?: boolean;
    debug?: boolean;
  }

  class POP3Client extends EventEmitter {
    constructor(port: number, host: string, options?: any);
    
    login(username: string, password: string): void;
    list(): void;
    retr(msgNumber: number): void;
    dele(msgNumber: number): void;
    quit(): void;
    
    on(event: 'connect', listener: () => void): this;
    on(event: 'invalid-state', listener: (cmd: string) => void): this;
    on(event: 'locked', listener: (cmd: string) => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    on(event: 'login', listener: (status: boolean, data: string) => void): this;
    on(event: 'list', listener: (resp: boolean, msgcount: number, msgnumber: number | undefined, returnValue: any, data: string) => void): this;
    on(event: 'retr', listener: (status: boolean, msgNumber: number, returnValue: any, rawData: any) => void): this;
    on(event: 'dele', listener: (status: boolean, msgNumber: number, data: string) => void): this;
    on(event: 'quit', listener: (status: boolean, data: string) => void): this;
  }

  export = POP3Client;
}