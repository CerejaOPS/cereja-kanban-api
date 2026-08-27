package com.cereja.kanban.domain.Task;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Task {
    private Long id;
    private String title;
    private String description;
    private TaskPhase phase;
    private TaskPriority priority;
    private Long boardId;
    private String assigneeDiscordId;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
