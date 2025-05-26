/// <reference types="jest" />

declare global {
  namespace jest {
    interface MockedFunction<T extends (...args: any[]) => any> extends jest.Mock<ReturnType<T>, Parameters<T>> {}
    
    type Mocked<T> = {
      [P in keyof T]: T[P] extends (...args: any[]) => any
        ? MockedFunction<T[P]>
        : T[P] extends object
        ? Mocked<T[P]>
        : T[P];
    } & T;
  }
}

export {};
