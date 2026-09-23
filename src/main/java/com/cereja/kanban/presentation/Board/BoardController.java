package com.cereja.kanban.presentation.Board;

import com.cereja.kanban.application.Board.BoardService;
import com.cereja.kanban.application.Task.TaskService;
import com.cereja.kanban.domain.Board.Board;
import com.cereja.kanban.domain.Task.Task;
import com.cereja.kanban.presentation.Board.DTO.BoardResponse;
import com.cereja.kanban.presentation.Board.DTO.CreateBoardRequest;
import com.cereja.kanban.presentation.Task.DTO.TaskResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/boards")

public class BoardController {

    private final BoardService boardService;
    private final TaskService taskService;

    public BoardController(BoardService boardService, TaskService taskService){

        this.boardService = boardService;
        this.taskService = taskService;
    }

    @PostMapping
    public ResponseEntity<BoardResponse> criar(@Valid @RequestBody CreateBoardRequest request){
        //converte o DTO da entrada para o Domínio
        Board novoBoard = new Board();
        novoBoard.setName(request.getName());
        novoBoard.setDescription(request.getDescription());

        //executa a regra do Service
        Board boardSalvo = boardService.createBoard(novoBoard);

        //converte o Domínio para o DTO de resposta
        BoardResponse response = new BoardResponse(
                boardSalvo.getId(),
                boardSalvo.getName(),
                boardSalvo.getDescription(),
                boardSalvo.getCreatedAt()
        );

        //retorna HTTP 201 (Created)
        return ResponseEntity.status(HttpStatus.CREATED).body(response);

    }

    //listar todos os Boards
    @GetMapping
    public ResponseEntity<List<BoardResponse>> listarTodos(){

        List<Board> boards = boardService.findAll();

        //converte a lista de Board para BoardResponse
        List<BoardResponse> responses = boards.stream()
                .map(board -> new BoardResponse(
                        board.getId(),
                        board.getName(),
                        board.getDescription(),
                        board.getCreatedAt()
                        )).toList();
        return ResponseEntity.ok(responses);//retorna Http 200 (ok)

    }
    //buscar por id
    @GetMapping("/{id}")
    public ResponseEntity<BoardResponse> buscarPorId(@PathVariable Long id){

        Board board = boardService.findById(id);

        BoardResponse response = new BoardResponse(
                board.getId(),
                board.getName(),
                board.getDescription(),
                board.getCreatedAt()
        );

        return ResponseEntity.ok(response);

    }

    //atualizar um board
    @PutMapping("/{id}")
    public ResponseEntity<BoardResponse> atualizar(@PathVariable Long id, @Valid @RequestBody CreateBoardRequest request){

        Board dadosNovos = new Board();
        dadosNovos.setName(request.getName());
        dadosNovos.setDescription(request.getDescription());

        Board boardAtualizado = boardService.update(id, dadosNovos);

        BoardResponse response = new BoardResponse(

                boardAtualizado.getId(),
                boardAtualizado.getName(),
                boardAtualizado.getDescription(),
                boardAtualizado.getCreatedAt()

        );

        return ResponseEntity.ok(response);

    }

    //deletar um Board
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletar(@PathVariable Long id){

        boardService.delete(id);

        return ResponseEntity.noContent().build();//retorna Http 204 indicanto que foi deletado com sucesso

    }

    @GetMapping("/{id}/tasks")
    public ResponseEntity<List<TaskResponse>> listarTasksDoBoard(@PathVariable Long id){

        //garante que o Board exista
        boardService.findById(id);

        //Busca todas as tasks associadas a este BoardId
        List<Task> tasks = taskService.findByBoardId(id);

        //converte as lista de task para taskResponse
        List<TaskResponse> responses = tasks.stream()
                .map(task -> new TaskResponse(
                        task.getId(),
                        task.getTitle(),
                        task.getDescription(),
                        task.getPhase(),
                        task.getPriority(),
                        task.getBoardId(),
                        task.getAssigneeDiscordId(),
                        task.getCreatedAt(),
                        task.getUpdatedAt()
                ))
                .toList();

        return ResponseEntity.ok(responses);

    }



}
