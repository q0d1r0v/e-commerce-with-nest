export interface IPaymentProvider {
  createPayment(orderId: string, amount: number): PaymentCreateResponse;
  checkPayment(transactionId: string): Promise<PaymentStatusResponse>;
  cancelPayment(transactionId: string): Promise<boolean>;
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
