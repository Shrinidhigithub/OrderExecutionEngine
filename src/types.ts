export type OrderStatus =
  | 'pending'
  | 'routing'
  | 'building'
  | 'submitted'
  | 'confirmed'
  | 'failed';

export interface Order {
  id: string;
  tokenIn: string;
  tokenOut: string;
  amount: number;
  status: OrderStatus;
  createdAt: string;
}
