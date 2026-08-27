package com.cereja.kanban.infrastructure.database.task;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataTaskRepository extends JpaRepository<TaskEntity, Long> {
}
