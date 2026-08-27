package com.cereja.kanban.presentation.Task.DTO;

import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.Task.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter

public class CreateTaskRequest {
    @NotBlank(message = "Título é obrigatório")
    private String title;

    private String description;

    private Long boardId;
    private String assigneeDiscordId;
    private TaskPriority priority;
}
