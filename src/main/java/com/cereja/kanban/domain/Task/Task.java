package com.cereja.kanban.domain.Task;

import com.cereja.kanban.domain.exception.InvalidPhaseTransitionException;
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

    public void moverParaFase(String novaFaseStr) {
        // 1. Convertemos a String recebida para o Enum correspondente
        TaskPhase novaFase = TaskPhase.valueOf(novaFaseStr);

        // 2. Validamos as regras de negócio baseadas no Enum atual e na nova fase
        if (TaskPhase.TODO.equals(this.phase) && TaskPhase.DONE.equals(novaFase)) {
            throw new InvalidPhaseTransitionException("Não é permitido ir de A Fazer direto para Concluído.");
        }
        else if (TaskPhase.IN_PROGRESS.equals(this.phase) && TaskPhase.DONE.equals(novaFase)) {
            throw new InvalidPhaseTransitionException("Não é permitido ir de Em Andamento para Concluído.");
        }

        // 3. Guardamos a fase anterior (caso precise para o log) e atualizamos a fase atual
        TaskPhase faseAnterior = this.phase;
        this.phase = novaFase;
    }
}