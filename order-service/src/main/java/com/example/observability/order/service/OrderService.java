package com.example.observability.order.service;

import com.example.observability.order.messaging.OrderProcessingService;
import com.example.observability.order.model.OrderDAO;
import com.example.observability.order.model.OrderStatus;
import com.example.observability.order.model.dto.Order;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;


@Service
@Slf4j
public class OrderService {

    private final OrderProcessingService orderProcessingService;

    public OrderService(OrderProcessingService orderProcessingService) {
        this.orderProcessingService = orderProcessingService;
    }

    public void placeOrder(Order order) {
        log.info("Placing order : order id {}", order.id());
        validateOrder(order);
        persistOrder(order);
        orderProcessingService.processOrderPayments(order);
    }

    public void updateOrder(Order order) {
        log.info("Updating order status : order id {}", order.id());
    }


    private void persistOrder(Order order) {
        OrderDAO orderDAO = new OrderDAO(order.id(), order.customerId(), order.items(), OrderStatus.PLACED, LocalDateTime.now(), LocalDateTime.now());
        log.info("Persisting order details for order : order id {}", order.id());
    }

    private void validateOrder(Order order) {
        log.info("validating order details for order {}", order.id());
    }
}
