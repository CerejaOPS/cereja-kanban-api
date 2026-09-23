package com.cereja.kanban.infrastructure.database.board;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SpringDataBoardRepository extends JpaRepository<BoardEntity, Long>{



}
