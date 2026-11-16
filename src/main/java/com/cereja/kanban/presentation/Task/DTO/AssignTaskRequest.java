package com.cereja.kanban.presentation.Task.DTO;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// DTO de entrada para atribuir ou desatribuir um responsavel a uma tarefa.
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AssignTaskRequest {

    private String assigneeDiscordId;

}