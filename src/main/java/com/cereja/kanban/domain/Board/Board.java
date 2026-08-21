package com.cereja.kanban.domain.Board;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Board {
    private Long id;
    private String name;
    private String description;
    private LocalDateTime createdAt;
}
