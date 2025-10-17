export interface IPaymentProvider {
  createPayment(orderId: string, amount: number): PaymentCreateResponse;
  checkPayment(transactionId: string): PaymentStatusResponse;
  cancelPayment(transactionId: string): boolean;
}

export interface PaymentCreateResponse {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
}

export interface PaymentStatusResponse {
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  transactionId: string;
  amount: number;
}
