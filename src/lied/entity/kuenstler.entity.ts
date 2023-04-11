import {
    Column,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Lied } from './lied.entity.js';

@Entity()
export class Kuenstler {
    @Column('int')
    // https://typeorm.io/entities#primary-columns
    // CAVEAT: zuerst @Column() und erst dann @PrimaryGeneratedColumn()
    @PrimaryGeneratedColumn()
    id: number | undefined;

    @Column('varchar', { unique: true, length: 32 })
    readonly name!: string;

    @ManyToOne(() => Lied, (lied) => lied.kuenstler)
    @JoinColumn({ name: 'lied_id' })
    lied: Lied | undefined;
}
