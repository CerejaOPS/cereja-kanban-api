package com.cereja.kanban.application.Board;

import com.cereja.kanban.domain.Board.Board;
import com.cereja.kanban.domain.Board.IBoardRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BoardService {

    private final IBoardRepository boardRepository;

    public BoardService(IBoardRepository boardRepository) {

        this.boardRepository = boardRepository;

    }

    //recebe um board com informações iniciais, manda salvar e retorna o ID gerado
    public Board createBoard(Board novoBoard){
        return boardRepository.save(novoBoard);
    }

    //retorna a lista de todos os boards cadastrados no sistema
    public List<Board>findAll(){
        return boardRepository.findall();
    }

    //busca um board pelo ID
    public Board findById(Long id){
        return boardRepository.findById(id).orElseThrow(()->
                new RuntimeException("Board não encontrado com o id: "+id));
    }


    //atualizar um board existente
    public Board update(Long id, Board dadosAtualizado){

        Board boardExistente = findById(id);

        boardExistente.setName(dadosAtualizado.getName());
        boardExistente.setDescription(dadosAtualizado.getDescription());

        return boardRepository.save(boardExistente);

    }

    //deletar um board
    public void delete(Long id){

        findById(id);

        boardRepository.deleteById(id);

    }



}
