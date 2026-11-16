package com.cereja.kanban.infrastructure.database.board;

import com.cereja.kanban.infrastructure.database.discordUser.DiscordUserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface SpringDataBoardRepository extends JpaRepository<BoardEntity, Long>{

    // Query que navega na coleção de 'membros' através do ID do board
    @Query("SELECT b.members FROM BoardEntity b WHERE b.id = :boardId")
    List<DiscordUserEntity> findMembersByBoardId(@Param("boardId") Long boardId);

}
