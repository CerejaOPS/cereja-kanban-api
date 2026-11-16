package com.cereja.kanban.infrastructure.database.board;

import com.cereja.kanban.domain.Board.Board;
import com.cereja.kanban.domain.Board.IBoardRepository;
import org.springframework.stereotype.Component;
import com.cereja.kanban.domain.DiscordUser.DiscordUser;
import com.cereja.kanban.infrastructure.database.discordUser.DiscordUserEntity;

import java.util.List;
import java.util.Optional;


@Component
public class BoardRepositoryAdapter implements IBoardRepository {

    //repositorio que conversa com o banco
    private SpringDataBoardRepository springDataRepository;

    //Construtor
    public BoardRepositoryAdapter(SpringDataBoardRepository springDataRepository){
        this.springDataRepository = springDataRepository;
    }

    //para salvar um board
    @Override
    public Board save(Board board){

        //converter do dominio para o banco
        BoardEntity entity = new BoardEntity();
        entity.setId(board.getId());
        entity.setName(board.getName());
        entity.setDescription(board.getDescription());

        //Salva no banco
        BoardEntity entitySalva = springDataRepository.save(entity);

        //converte de volta e retorna
        return converterParaDominio(entitySalva);

    }

    private Board converterParaDominio(BoardEntity entity){

        Board board = new Board();
        board.setId(entity.getId());
        board.setName(entity.getName());
        board.setDescription(entity.getDescription());
        board.setCreatedAt(entity.getCreatedAt());
        return board;
    }

    @Override
    public Optional<Board> findById(Long id){
        return springDataRepository.findById(id).map(this::converterParaDominio);
    }
    
    @Override
    public List<Board> findall(){

        return springDataRepository.findAll()
                .stream()
                .map(this::converterParaDominio)
                .toList();

    }

    @Override
    public void deleteById(Long id){
        springDataRepository.deleteById(id);
    }

    // Implementa o contrato do domínio: consulta o Spring Data e converte o resultado do banco para o domínio
    @Override
    public List<DiscordUser> findMembersByBoardId(Long boardId) {
        List<DiscordUserEntity> entities = springDataRepository.findMembersByBoardId(boardId);
        return entities.stream()
                .map(this::converterUsuarioParaDominio)
                .toList();
    }

    // Método auxiliar: traduz a entidade do banco para o modelo de domínio puro
    private DiscordUser converterUsuarioParaDominio(DiscordUserEntity entity) {
        DiscordUser user = new DiscordUser();
        user.setId(entity.getId());
        user.setDiscordId(entity.getDiscordId());
        user.setUsername(entity.getUsername());
        user.setAvatar(entity.getAvatar());
        user.setRole(entity.getRole());
        return user;
    }
}
