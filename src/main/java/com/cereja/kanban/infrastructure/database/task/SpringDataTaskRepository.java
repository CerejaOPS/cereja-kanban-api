package com.cereja.kanban.infrastructure.database.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SpringDataTaskRepository extends JpaRepository<TaskEntity, Long> {
    List<TaskEntity> findByBoardId(Long boardId);
}
