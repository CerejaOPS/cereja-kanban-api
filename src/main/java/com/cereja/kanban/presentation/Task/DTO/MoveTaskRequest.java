package com.cereja.kanban.presentation.Task.DTO;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * DTO de requisição para o endpoint de movimentação de tarefa entre fases.
 * Utilizado em: {@code PATCH /api/tasks/{id}/move}
 *
 * @param phase   Nome da fase de destino. Deve corresponder a um valor do enum {@code TaskPhase}
 *                (ex: BACKLOG, TODO, IN_PROGRESS, REVIEW, DONE).
 * @param movedBy Identificador de quem acionou a movimentação (ex: Discord ID ou nome do usuário).
 */
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MoveTaskRequest {

    @NotBlank(message = "A fase de destino é obrigatória")
    private String phase;

    @NotBlank(message = "O responsável pela movimentação é obrigatório")
    private String movedBy;
}
