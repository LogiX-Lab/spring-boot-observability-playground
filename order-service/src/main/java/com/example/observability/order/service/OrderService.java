package com.example.observability.order.service;

import com.example.observability.order.messaging.OrderProcessingService;
import com.example.observability.order.model.OrderStatus;
import com.example.observability.order.model.dto.Order;
import com.example.observability.order.model.dto.OrderHistoryDto;
import com.example.observability.order.model.entity.OrderEntity;
import com.example.observability.order.model.entity.OrderItemEntity;
import com.example.observability.order.repository.OrderRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;


@Service
@Slf4j
public class OrderService {

    private final OrderProcessingService orderProcessingService;
    private final OrderRepository orderRepository;

    public OrderService(OrderProcessingService orderProcessingService, OrderRepository orderRepository) {
        this.orderProcessingService = orderProcessingService;
        this.orderRepository = orderRepository;
    }

    @Transactional
    public void placeOrder(Order order) {
        log.info("Placing order : order id {}", order.id());
        validateOrder(order);
        persistOrder(order);
        orderProcessingService.processOrderPayments(order);
    }

    @Transactional
    public void updateOrder(Order order) {
        log.info("Updating order status : order id {}", order.id());
        orderRepository.findById(order.id()).ifPresentOrElse(entity -> {
            if (order.orderStatus() != null) {
                entity.setStatus(order.orderStatus());
            }
            orderRepository.save(entity);
            log.info("Order {} status updated to {}", order.id(), entity.getStatus());
        }, () -> log.warn("Order {} not found for status update", order.id()));
    }

    @Transactional(readOnly = true)
    public List<OrderHistoryDto> getOrders(Long customerId) {
        List<OrderEntity> entities = (customerId != null)
                ? orderRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)
                : orderRepository.findAllByOrderByCreatedAtDesc();
        return entities.stream().map(this::toDto).toList();
    }

    private void persistOrder(Order order) {
        double totalAmount = order.items().stream()
                .mapToDouble(item -> item.quantity() * item.price())
                .sum();

        OrderEntity entity = new OrderEntity();
        entity.setId(order.id());
        entity.setCustomerId(order.customerId());
        entity.setPaymentToken(order.paymentToken());
        entity.setStatus(OrderStatus.PLACED);
        entity.setTotalAmount(totalAmount);

        order.items().forEach(item -> {
            OrderItemEntity itemEntity = new OrderItemEntity();
            itemEntity.setOrder(entity);
            itemEntity.setProductId(item.productId());
            itemEntity.setQuantity(item.quantity());
            itemEntity.setPrice(item.price());
            entity.getItems().add(itemEntity);
        });

        orderRepository.save(entity);
        log.info("Persisted order {} with {} items, total ${}", order.id(), order.items().size(), totalAmount);
    }

    private void validateOrder(Order order) {
        log.info("Validating order details for order {}", order.id());
    }

    private OrderHistoryDto toDto(OrderEntity e) {
        List<OrderHistoryDto.ItemDto> items = e.getItems().stream()
                .map(i -> new OrderHistoryDto.ItemDto(i.getProductId(), i.getQuantity(), i.getPrice()))
                .toList();
        return new OrderHistoryDto(
                e.getId(), e.getCustomerId(), e.getStatus().name(),
                e.getTotalAmount(), e.getCreatedAt(), e.getUpdatedAt(), items);
    }
}
