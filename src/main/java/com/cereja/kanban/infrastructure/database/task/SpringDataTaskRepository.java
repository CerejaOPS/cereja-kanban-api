package com.cereja.kanban.infrastructure.database.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SpringDataTaskRepository extends JpaRepository<TaskEntity, Long> {
}
