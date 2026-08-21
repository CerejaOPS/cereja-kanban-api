package com.cereja.kanban.domain.Board;

import java.util.List;
import java.util.Optional;

public interface IBoardRepository {
    Board save(Board board);
    List<Board> findall();
    Optional<Board> findById(Long id);
    void deleteById(Long id);
}
