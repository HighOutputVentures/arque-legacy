/* @flow */
export type AMQPMessage = {
  properties: {
    correlationId: string,
    replyTo: string,
  },
  content: Buffer
}

export type AMQPConsumer = (AMQPMessage) => Promise<void>

export type AMQPChannel = {
  assertQueue(string, options: {
    exclusive?: boolean,
    messageTtl?: number,
    expires? : number
  }): Promise<void>,
  consume(string, AMQPConsumer): Promise<void>,
  ack(AMQPMessage): Promise<void>,
  sendToQueue(string, Buffer, options: {
    expiration?: number,
    persistent?: boolean,
    correlationId?: string,
    replyTo?: string
  }): Promise<void>,
  close(): Promise<void>,
  on(string, Function): void
}

export type AMQPConnection = {
  createChannel(): Promise<AMQPChannel>
}

export type ArqueRequest = {
  correlationId: string,
  arguments: Array<mixed>,
  timestamp: number
}

export type ArqueResponse = {
  result?: mixed,
  error?: {
    message: string
  },
  timestamp: number
}

export interface IArque {
  options: {uri: string, prefix: string},
  assertConnection(): Promise<AMQPConnection>
}
