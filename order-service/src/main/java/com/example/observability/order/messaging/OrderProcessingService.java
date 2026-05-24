package com.example.observability.order.messaging;

import com.example.observability.order.model.OrderPayment;
import com.example.observability.order.model.dto.Order;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.ThreadLocalRandom;

@Service
@Slf4j
public class OrderProcessingService {
    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    public void processOrderPayments(Order order) {
        try {
            // Serialize the Order object to JSON
            String orderJson = objectMapper.writeValueAsString(getOrderPayment(order));

            // Send the JSON payload to Kafka
            kafkaTemplate.send("order-events", String.valueOf(order.id()), orderJson);
        } catch (JsonProcessingException e) {
           throw new RuntimeException("Failed to serialize order payment", e);
        }
    }

    private OrderPayment getOrderPayment(Order order){
        double amount = ThreadLocalRandom.current().nextDouble(10, 120);
        return new OrderPayment(order.id(),order.paymentToken(), amount);
    }
}
