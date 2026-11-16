package com.cereja.kanban.infrastructure.database.comment;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SpringDataTaskCommentRepository extends JpaRepository<TaskCommentEntity, Long> {
    List<TaskCommentEntity> findByTaskIdOrderByCreatedAtAsc(Long taskId);
}