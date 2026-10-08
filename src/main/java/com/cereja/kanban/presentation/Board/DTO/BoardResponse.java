package com.cereja.kanban.presentation.Board.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor

public class BoardResponse {

    private Long id;
    private String name;
    private String description;
    private LocalDateTime cratedAt;

}
