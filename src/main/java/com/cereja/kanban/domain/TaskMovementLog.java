package com.cereja.kanban.domain;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

import com.cereja.kanban.domain.Task.TaskPhase;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TaskMovementLog {

    private Long id;
    private Long taskId;
    private TaskPhase faseAnterior;
    private TaskPhase faseNova;
    private String movidoPor;
    private LocalDateTime movidoEm;

    public TaskMovementLog(Long taskId, TaskPhase faseAnterior, TaskPhase faseNova, String movidoPor, LocalDateTime movidoEm) {
        this.taskId = taskId;
        this.faseAnterior = faseAnterior;
        this.faseNova = faseNova;
        this.movidoPor = movidoPor;
        this.movidoEm = movidoEm;
    }
}