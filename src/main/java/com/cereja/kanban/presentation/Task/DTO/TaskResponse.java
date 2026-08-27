package com.cereja.kanban.presentation.Task.DTO;

import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.Task.TaskPriority;
import lombok.Getter;
import lombok.Setter;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private TaskPhase phase;
    private TaskPriority priority;
    private Long boardId;                  // Adicione
    private String assigneeDiscordId;      // Adicione
    private LocalDateTime createdAt;       // Renomeie de criadoEm
    private LocalDateTime updatedAt;       // Adicione
}