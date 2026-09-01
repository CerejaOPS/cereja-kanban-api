package com.cereja.kanban.repository;

import com.cereja.kanban.domain.TaskMovementLog;
import com.cereja.kanban.domain.TaskMovementLogRepository;
import org.springframework.stereotype.Repository;

import java.util.ArrayList;
import java.util.List;

@Repository
public class InMemoryLogRepository implements TaskMovementLogRepository {

    private final List<TaskMovementLog> tabelaLogs = new ArrayList<>();

    @Override
    public void save(TaskMovementLog log) {
        tabelaLogs.add(log);
        System.out.println("LOG SALVO: Tarefa " + log.getTaskId() +
                " movida de " + log.getFaseAnterior() +
                " para " + log.getFaseNova());
    }
}