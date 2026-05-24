package com.example.observability.payment.service;

import com.example.observability.payment.model.OrderPayment;
import com.example.observability.payment.model.PaymentStatus;
import com.example.observability.payment.model.entity.PaymentEntity;
import com.example.observability.payment.repository.PaymentRepository;
import io.micrometer.observation.annotation.Observed;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Slf4j
public class PaymentService {

    private final PaymentRepository paymentRepository;

    public PaymentService(PaymentRepository paymentRepository) {
        this.paymentRepository = paymentRepository;
    }

    @Observed(name = "payment:processPayment")
    @Transactional
    public void processPayment(OrderPayment orderPayment) {
        log.info("Starting payment processing for Order ID: {}", orderPayment.id());

        try {
            log.info("Validating payment details for Order ID: {}", orderPayment.id());
            Thread.sleep(500);
            log.info("Payment details validated for Order ID: {}", orderPayment.id());
            log.info("Authorizing payment for Order ID: {}", orderPayment.id());
            Thread.sleep(500);
            log.info("Payment authorized for Order ID: {}", orderPayment.id());
            log.info("Capturing payment for Order ID: {}", orderPayment.id());
            Thread.sleep(500);
            log.info("Payment captured for Order ID: {}", orderPayment.id());
            log.info("Completing payment processing for Order ID: {}", orderPayment.id());
            Thread.sleep(500);
            log.info("Payment processing completed for Order ID: {}", orderPayment.id());

            savePayment(orderPayment, PaymentStatus.COMPLETED);
        } catch (InterruptedException e) {
            log.error("Thread was interrupted while processing payment for Order ID: {}", orderPayment.id(), e);
            savePayment(orderPayment, PaymentStatus.FAILED);
        } catch (Exception e) {
            log.error("Exception occurred while processing payment for Order ID: {}", orderPayment.id(), e);
            savePayment(orderPayment, PaymentStatus.FAILED);
        }
    }

    private void savePayment(OrderPayment orderPayment, PaymentStatus status) {
        PaymentEntity entity = new PaymentEntity();
        entity.setOrderId(orderPayment.id());
        entity.setPaymentToken(orderPayment.paymentToken());
        entity.setAmount(orderPayment.amount());
        entity.setStatus(status);
        paymentRepository.save(entity);
        log.info("Payment record saved for Order ID: {} with status {}", orderPayment.id(), status);
    }
}
