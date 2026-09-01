package com.cereja.kanban.application.Task;

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

    // 2. O construtor exige os dois repositórios de quem for instanciar essa classe
    public MoveTaskUseCase(ITaskRepository taskRepository, TaskMovementLogRepository logRepository) {
        this.taskRepository = taskRepository;
        this.logRepository = logRepository;
    }

    // 3. O seu método execute intacto e perfeito!
    public void execute(Long taskId, String newPhase, String drivenBy) {

        Task taskEncontrada = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Tarefa não encontrada com o ID: " + taskId));

        String previousPhase = String.valueOf(taskEncontrada.getPhase());

        // Normalização amigável de fases para o padrão do Enum TaskPhase
        String phaseToEnum = newPhase;
        if (newPhase != null) {
            String normalized = newPhase.toUpperCase().trim();
            if ("DOING".equals(normalized) || "EM_ANDAMENTO".equals(normalized)) {
                phaseToEnum = "IN_PROGRESS";
            } else if ("A_FAZER".equals(normalized)) {
                phaseToEnum = "TODO";
            } else if ("CONCLUIDO".equals(normalized) || "CONCLUÍDO".equals(normalized)) {
                phaseToEnum = "DONE";
            } else if ("REVISAO".equals(normalized) || "REVISÃO".equals(normalized)) {
                phaseToEnum = "REVIEW";
            }
        }

        // Executa a transição de fase utilizando o modelo de domínio rico (que valida as regras de negócio)
        taskEncontrada.moverParaFase(phaseToEnum);

        Task taskUpdate = taskRepository.save(taskEncontrada);

        TaskMovementLog saveLog = new TaskMovementLog(taskId, previousPhase, phaseToEnum, drivenBy, LocalDateTime.now());

        logRepository.save(saveLog);
    }
}