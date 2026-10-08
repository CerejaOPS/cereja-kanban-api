package com.cereja.kanban.domain;

public interface TaskMovementLogRepository {
    void save(TaskMovementLog log);
}