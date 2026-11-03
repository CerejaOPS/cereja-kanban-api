package com.cereja.kanban.application.Task;

import com.cereja.kanban.application.events.IBoardEventPublisher;
import com.cereja.kanban.domain.Task.ITaskRepository;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.domain.Task.TaskPhase;
import com.cereja.kanban.domain.TaskMovementLog;
import com.cereja.kanban.domain.TaskMovementLogRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service

public class MoveTaskUseCase {

    // 1. Declaramos os dois repositórios como atributos (private final é uma boa prática)
    private final ITaskRepository taskRepository;
    private final TaskMovementLogRepository logRepository;
    private final IBoardEventPublisher eventPublisher;

    // 2. O construtor exige os dois repositórios de quem for instanciar essa classe
    public MoveTaskUseCase(ITaskRepository taskRepository, TaskMovementLogRepository logRepository, IBoardEventPublisher eventPublisher) {
        this.taskRepository = taskRepository;
        this.logRepository = logRepository;
        this.eventPublisher = eventPublisher;
    }

   public void execute(Long taskId, TaskPhase newPhase, String drivenBy) {
        Task taskEncontrada = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tarefa não encontrada com o ID: " + taskId));
        TaskPhase previousPhase = taskEncontrada.getPhase();
        taskEncontrada.setPhase(newPhase);
        taskRepository.save(taskEncontrada);
        TaskMovementLog saveLog = new TaskMovementLog(taskId, previousPhase, newPhase, drivenBy, LocalDateTime.now());
        logRepository.save(saveLog);
        eventPublisher.publish(taskEncontrada.getBoardId(), "TASK_MOVED", taskEncontrada);
    }
}