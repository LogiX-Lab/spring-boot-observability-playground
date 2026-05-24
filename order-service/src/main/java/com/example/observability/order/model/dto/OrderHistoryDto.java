package com.example.observability.order.model.dto;

import java.time.LocalDateTime;
import java.util.List;

public record OrderHistoryDto(
        Long id,
        Long customerId,
        String status,
        Double totalAmount,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<ItemDto> items
) {
    public record ItemDto(Long productId, Integer quantity, Double price) {}
}
